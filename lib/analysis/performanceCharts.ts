import type { AccountSnapshot, Reel } from "@/lib/schemas";
import { sortByDate } from "@/lib/analysis/followerTrend";
import { toSeoulDate } from "@/lib/analysis/uploadRhythm";
import { reelTitle } from "@/lib/ui/reelTitle";
import { DAY_MS } from "@/lib/time";

/** 기본 표시 구간. 릴스 계정의 한 사이클(주 2~3회 업로드 × 4주)이 다 들어가는 길이다. */
const DEFAULT_WINDOW_DAYS = 30;

/** 막대 툴팁에 띄울 릴스 한 건. 차트가 스키마 전체를 알 필요는 없다. */
interface ChartReel {
  id: string;
  title: string;
  views: number;
  thumbnailUrl?: string;
  permalink?: string;
}

export interface ViewsDayPoint {
  /** 현재 구간의 날짜 (한국 시간 기준 YYYY-MM-DD) */
  date: string;
  /** 그날 게시한 릴스의 조회수 합. 게시가 없으면 null — 0 막대를 그리지 않기 위해서다. */
  views: number | null;
  /** 구간 시작부터의 누적. 게시가 없는 날은 직전 값을 물려받아 계단이 된다. */
  cumulative: number;
  /** 그날 게시한 릴스들. 합산 막대의 내역을 툴팁에서 풀어 보여준다. */
  reels: ChartReel[];
  /** 같은 위치에 겹쳐 그릴 이전 기간의 날짜 */
  prevDate: string | null;
  prevViews: number | null;
  prevCumulative: number | null;
}

export interface FollowerDayPoint {
  date: string;
  /** 직전 스냅샷 대비 증감. 그날 스냅샷이 없으면 null. */
  gained: number | null;
  /** 그날 스냅샷의 절대 팔로워 수. 없으면 null. */
  total: number | null;
  prevDate: string | null;
  prevGained: number | null;
  prevTotal: number | null;
}

interface ChartRange {
  start: string;
  end: string;
  days: number;
}

export interface PerformanceCharts {
  /** 실제로 그리는 구간. 데이터가 하나도 없으면 null. */
  range: ChartRange | null;
  previousRange: Omit<ChartRange, "days"> | null;
  views: ViewsDayPoint[];
  followers: FollowerDayPoint[];
  hasViews: boolean;
  hasFollowerGain: boolean;
  hasFollowerTotal: boolean;
  /** 이전 기간에 겹쳐 그릴 값이 하나라도 있는가. 없으면 토글을 켤 이유가 없다. */
  hasPrevious: boolean;
}

export interface PerformanceChartsOptions {
  windowDays?: number;
}

function addDays(date: string, days: number): string {
  return toIsoDay(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS);
}

function toIsoDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** 게시 시각(UTC 문자열) → 올린 사람의 하루. 밤에 올린 릴스가 전날 막대로 밀리지 않게 한다. */
function postedDay(reel: Reel): string {
  return toSeoulDate(new Date(reel.postedAt));
}

function toChartReel(reel: Reel): ChartReel {
  return {
    id: reel.id,
    title: reelTitle(reel),
    views: reel.views,
    thumbnailUrl: reel.thumbnailUrl,
    permalink: reel.permalink,
  };
}

/** 날짜별 게시 릴스. 같은 날 여러 건이면 시간 순으로 쌓인다. */
function groupReelsByDay(reels: Reel[]): Map<string, ChartReel[]> {
  const sorted = [...reels].sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  const byDay = new Map<string, ChartReel[]>();
  for (const reel of sorted) {
    const day = postedDay(reel);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(toChartReel(reel));
    else byDay.set(day, [toChartReel(reel)]);
  }
  return byDay;
}

/**
 * 스냅샷 델타. 값은 나중 스냅샷의 날짜에 실린다.
 *
 * 구간을 자르기 전 전체 스냅샷으로 계산하는 이유: 구간 첫날의 증가분은 구간 밖
 * 직전 스냅샷과의 차이다. 먼저 자르면 첫 막대가 통째로 사라진다.
 */
function followerGainByDay(snapshots: AccountSnapshot[]): Map<string, number> {
  const sorted = sortByDate(snapshots);
  const gains = new Map<string, number>();
  for (let i = 1; i < sorted.length; i += 1) {
    gains.set(sorted[i].date, sorted[i].followerCount - sorted[i - 1].followerCount);
  }
  return gains;
}

function followerTotalByDay(snapshots: AccountSnapshot[]): Map<string, number> {
  return new Map(sortByDate(snapshots).map((snapshot) => [snapshot.date, snapshot.followerCount]));
}

/**
 * 표시 구간. 끝은 마지막 데이터 날짜다.
 *
 * 오늘에 붙이지 않는 이유: 동기화를 며칠 쉬거나 데모 데이터를 볼 때 최근 30일에
 * 데이터가 하나도 없어 빈 축만 남는다. 시작은 30일 전과 첫 데이터 날짜 중 나중 것이라
 * 데이터가 짧으면 있는 만큼만 그린다.
 */
function resolveRange(days: string[], windowDays: number): ChartRange | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort();
  const end = sorted[sorted.length - 1];
  const windowStart = addDays(end, -(windowDays - 1));
  const start = sorted[0] > windowStart ? sorted[0] : windowStart;
  return { start, end, days: eachDay(start, end).length };
}

export function buildPerformanceCharts(
  reels: Reel[],
  snapshots: AccountSnapshot[],
  options: PerformanceChartsOptions = {},
): PerformanceCharts {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const reelsByDay = groupReelsByDay(reels);
  const gains = followerGainByDay(snapshots);
  const totals = followerTotalByDay(snapshots);

  const dataDays = [...reelsByDay.keys(), ...totals.keys()];
  const range = resolveRange(dataDays, windowDays);
  if (range === null) {
    return {
      range: null,
      previousRange: null,
      views: [],
      followers: [],
      hasViews: false,
      hasFollowerGain: false,
      hasFollowerTotal: false,
      hasPrevious: false,
    };
  }

  const currentDays = eachDay(range.start, range.end);
  const previousEnd = addDays(range.start, -1);
  const previousStart = addDays(previousEnd, -(range.days - 1));
  const previousDays = eachDay(previousStart, previousEnd);

  const views = buildViewsPoints(currentDays, previousDays, reelsByDay);
  const followers = buildFollowerPoints(currentDays, previousDays, gains, totals);

  return {
    range,
    previousRange: { start: previousStart, end: previousEnd },
    views,
    followers,
    hasViews: views.some((point) => point.views !== null),
    hasFollowerGain: followers.some((point) => point.gained !== null),
    hasFollowerTotal: followers.some((point) => point.total !== null),
    hasPrevious:
      views.some((point) => point.prevViews !== null) ||
      followers.some((point) => point.prevTotal !== null),
  };
}

function buildViewsPoints(
  currentDays: string[],
  previousDays: string[],
  reelsByDay: Map<string, ChartReel[]>,
): ViewsDayPoint[] {
  let cumulative = 0;
  let prevCumulative = 0;

  return currentDays.map((date, index) => {
    const dayReels = reelsByDay.get(date) ?? [];
    const dayViews = dayReels.length > 0 ? sumViews(dayReels) : null;
    cumulative += dayViews ?? 0;

    const prevDate = previousDays[index] ?? null;
    const prevReels = prevDate !== null ? (reelsByDay.get(prevDate) ?? []) : [];
    const prevViews = prevReels.length > 0 ? sumViews(prevReels) : null;
    prevCumulative += prevViews ?? 0;

    return {
      date,
      views: dayViews,
      cumulative,
      reels: dayReels,
      prevDate,
      prevViews,
      // 이전 기간 누적도 0에서 다시 시작한다. 이어 붙이면 두 기간의 기울기를 견줄 수 없다.
      prevCumulative: prevDate === null ? null : prevCumulative,
    };
  });
}

function buildFollowerPoints(
  currentDays: string[],
  previousDays: string[],
  gains: Map<string, number>,
  totals: Map<string, number>,
): FollowerDayPoint[] {
  return currentDays.map((date, index) => {
    const prevDate = previousDays[index] ?? null;
    return {
      date,
      gained: gains.get(date) ?? null,
      total: totals.get(date) ?? null,
      prevDate,
      prevGained: prevDate === null ? null : (gains.get(prevDate) ?? null),
      prevTotal: prevDate === null ? null : (totals.get(prevDate) ?? null),
    };
  });
}

function sumViews(reels: ChartReel[]): number {
  return reels.reduce((sum, reel) => sum + reel.views, 0);
}
