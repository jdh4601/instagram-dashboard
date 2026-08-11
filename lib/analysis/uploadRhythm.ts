import type { MediaKind, Reel } from "@/lib/schemas";
import { mediaKindOf } from "@/lib/media/kind";

// 게시 시각은 UTC로 들어오지만 리듬은 올린 사람의 하루 감각을 따라야 한다.
// UTC로 끊으면 밤에 올린 게시물이 전날 칸으로 밀려 공백이 실제와 달라진다.
const TIME_ZONE = "Asia/Seoul";
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_COUNT = 7;
/** 조회수 진하기 단계. 0단계는 "업로드 없음"이라 1부터 쓴다. */
const MAX_LEVEL = 4;

export interface RhythmDay {
  /** 한국 시간 기준 날짜 (YYYY-MM-DD) */
  date: string;
  day: number;
  reels: number;
  carousels: number;
  views: number;
  /** 진하기를 정할 때 기준이 된 종류. 업로드가 없으면 null */
  dominant: MediaKind | null;
  /** 1~4. 업로드가 없으면 0 */
  level: number;
  /** 아직 오지 않은 날. 쉰 날로 세지 않는다. */
  future: boolean;
}

export interface RhythmTotals {
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

/**
 * 종류별 조회수 사분위로 진하기 단계를 나눈다. 릴스와 캐러셀은 조회수 자릿수가
 * 달라 한데 묶으면 캐러셀이 전부 옅은 칸이 된다.
 */
function buildLevelScale(values: number[]): (value: number) => number {
  if (values.length === 0) return () => 1;
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
  const thresholds = [quantile(0.25), quantile(0.5), quantile(0.75)];
  return (value: number) => {
    let level = 1;
    for (const threshold of thresholds) {
      if (value > threshold) level++;
    }
    return Math.min(level, MAX_LEVEL);
  };
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
  const posted = reels
    .map((reel) => ({ date: toSeoulDate(new Date(reel.postedAt)), kind: mediaKindOf(reel), views: reel.views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const today = toSeoulDate(now);
  const currentMonth = parseYearMonth(today);
  const latestMonth = posted.length > 0 ? parseYearMonth(posted[posted.length - 1].date) : currentMonth;
  const earliestMonth = posted.length > 0 ? parseYearMonth(posted[0].date) : currentMonth;
  const shown = target ?? latestMonth;

  const levelOf: Record<MediaKind, (value: number) => number> = {
    REELS: buildLevelScale(posted.filter((p) => p.kind === "REELS").map((p) => p.views)),
    CAROUSEL: buildLevelScale(posted.filter((p) => p.kind === "CAROUSEL").map((p) => p.views)),
  };

  const monthPrefix = `${shown.year}-${String(shown.month).padStart(2, "0")}`;
  const days: RhythmDay[] = [];
  for (let day = 1; day <= daysInMonth(shown); day++) {
    const date = `${monthPrefix}-${String(day).padStart(2, "0")}`;
    const onDay = posted.filter((p) => p.date === date);
    const reelCount = onDay.filter((p) => p.kind === "REELS").length;
    const carouselCount = onDay.filter((p) => p.kind === "CAROUSEL").length;
    const dominant: MediaKind | null =
      onDay.length === 0 ? null : carouselCount > reelCount ? "CAROUSEL" : "REELS";
    const views = onDay.reduce((sum, p) => sum + p.views, 0);
    const dominantViews = onDay
      .filter((p) => p.kind === dominant)
      .reduce((sum, p) => sum + p.views, 0);
    days.push({
      date,
      day,
      reels: reelCount,
      carousels: carouselCount,
      views,
      dominant,
      level: dominant ? levelOf[dominant](dominantViews) : 0,
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

export { DAY_MS };
