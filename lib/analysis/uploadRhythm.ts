import type { MediaKind, Reel } from "@/lib/schemas";
import { mediaKindOf } from "@/lib/media/kind";
import { reelTitle } from "@/lib/ui/reelTitle";

// 게시 시각은 UTC로 들어오지만 리듬은 올린 사람의 하루 감각을 따라야 한다.
// UTC로 끊으면 밤에 올린 게시물이 전날 칸으로 밀려 공백이 실제와 달라진다.
const TIME_ZONE = "Asia/Seoul";
const WEEKDAY_COUNT = 7;

/** 달력 칸을 가리켰을 때 보여 줄 게시물 한 건. */
export interface RhythmPost {
  id: string;
  kind: MediaKind;
  title: string;
  thumbnailUrl?: string;
  views: number;
}

export interface RhythmDay {
  /** 한국 시간 기준 날짜 (YYYY-MM-DD) */
  date: string;
  day: number;
  reels: number;
  carousels: number;
  views: number;
  /** 그날 올린 게시물. 올린 순서대로 담긴다. */
  posts: RhythmPost[];
  /** 아직 오지 않은 날. 쉰 날로 세지 않는다. */
  future: boolean;
}

interface RhythmTotals {
  reels: number;
  carousels: number;
  uploadDays: number;
  /** 표시 중인 달 안에서 업로드가 없던 최장 연속 일수 */
  longestGapDays: number;
}

export interface UploadRhythm {
  year: number;
  /** 1~12 */
  month: number;
  label: string;
  /** weeks[주 0..n][요일 0=일] — 달력과 같은 배열. 그 달이 아닌 칸은 null */
  weeks: (RhythmDay | null)[][];
  totals: RhythmTotals;
  hasPrev: boolean;
  hasNext: boolean;
}

interface YearMonth {
  year: number;
  month: number;
}

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 한국 시간 기준 YYYY-MM-DD */
export function toSeoulDate(value: Date): string {
  return dateParts.format(value);
}

function parseYearMonth(date: string): YearMonth {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 그 달 1일의 요일 (0=일). UTC 기준으로 계산해 실행 환경 시간대에 흔들리지 않는다. */
function firstWeekdayOf({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

function countGap(days: RhythmDay[]): number {
  let longest = 0;
  let current = 0;
  for (const day of days) {
    if (day.future) break;
    if (day.reels + day.carousels > 0) {
      current = 0;
      continue;
    }
    current++;
    if (current > longest) longest = current;
  }
  return longest;
}

export function buildUploadRhythm(
  reels: Reel[],
  target?: YearMonth,
  now: Date = new Date(),
): UploadRhythm {
  // 같은 날 여러 건이면 올린 순서대로 보여 준다 — 달력 칸의 동그라미 순서가 곧 그날의 순서다.
  const posted = reels
    .map((reel) => ({
      date: toSeoulDate(new Date(reel.postedAt)),
      postedAt: reel.postedAt,
      kind: mediaKindOf(reel),
      views: reel.views,
      post: {
        id: reel.id,
        kind: mediaKindOf(reel),
        title: reelTitle(reel),
        ...(reel.thumbnailUrl ? { thumbnailUrl: reel.thumbnailUrl } : {}),
        views: reel.views,
      } satisfies RhythmPost,
    }))
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt));

  const today = toSeoulDate(now);
  const currentMonth = parseYearMonth(today);
  const latestMonth = posted.length > 0 ? parseYearMonth(posted[posted.length - 1].date) : currentMonth;
  const earliestMonth = posted.length > 0 ? parseYearMonth(posted[0].date) : currentMonth;
  const shown = target ?? latestMonth;

  const monthPrefix = `${shown.year}-${String(shown.month).padStart(2, "0")}`;
  const days: RhythmDay[] = [];
  for (let day = 1; day <= daysInMonth(shown); day++) {
    const date = `${monthPrefix}-${String(day).padStart(2, "0")}`;
    const onDay = posted.filter((p) => p.date === date);
    days.push({
      date,
      day,
      reels: onDay.filter((p) => p.kind === "REELS").length,
      carousels: onDay.filter((p) => p.kind === "CAROUSEL").length,
      views: onDay.reduce((sum, p) => sum + p.views, 0),
      posts: onDay.map((p) => p.post),
      future: date > today,
    });
  }

  const offset = firstWeekdayOf(shown);
  const rows = Math.ceil((offset + days.length) / WEEKDAY_COUNT);
  const weeks: (RhythmDay | null)[][] = Array.from({ length: rows }, (_, week) =>
    Array.from({ length: WEEKDAY_COUNT }, (_, weekday) => days[week * WEEKDAY_COUNT + weekday - offset] ?? null),
  );

  return {
    year: shown.year,
    month: shown.month,
    label: `${shown.year}년 ${shown.month}월`,
    weeks,
    totals: {
      reels: days.reduce((sum, day) => sum + day.reels, 0),
      carousels: days.reduce((sum, day) => sum + day.carousels, 0),
      uploadDays: days.filter((day) => day.reels + day.carousels > 0).length,
      longestGapDays: countGap(days),
    },
    hasPrev: posted.length > 0 && compareYearMonth(earliestMonth, shown) < 0,
    hasNext: compareYearMonth(shown, currentMonth) < 0,
  };
}

/** 좌우 화살표가 옮겨 갈 달. 격자 계산과 달 넘김 규칙을 한곳에 둔다. */
export function shiftMonth({ year, month }: YearMonth, step: number): YearMonth {
  const shifted = new Date(Date.UTC(year, month - 1 + step, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

