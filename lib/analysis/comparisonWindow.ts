import type { AccountSnapshot } from "@/lib/schemas";
import { sortByDate } from "@/lib/analysis/followerTrend";

// 계정 지표 비교 기준 창. 상단 개요 카드와 계정 인사이트가 이 값을 공유한다.
//
// 7일로 고정하는 이유: Graph API의 계정 지표(reach, views, accounts_engaged...)는
// 이미 7일 롤링 합계다. 이걸 이틀 전 스냅샷과 비교하면 두 창이 5/7 겹쳐서 증감이
// 사실상 노이즈가 된다. 7일 전과 비교해야 겹치지 않는 두 주를 견준다.
export const COMPARISON_WINDOW_DAYS = 7;

function toTime(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(toTime(a) - toTime(b)) / 86_400_000;
}

/**
 * `current`보다 `minDaysApart`일 이상 앞선 스냅샷 중 가장 최근 것.
 *
 * 스냅샷은 매일 찍히지 않는다(실측: 26일간 14일치). "직전 스냅샷"을 쓰면 비교
 * 대상이 하루 전일 수도 닷새 전일 수도 있어 같은 화면의 두 카드가 서로 다른
 * 결론을 낸다. 기준을 찾지 못하면 아무거나 대신 쓰지 않고 null을 준다.
 */
export function findComparisonSnapshot(
  snapshots: AccountSnapshot[],
  current: AccountSnapshot,
  minDaysApart: number = COMPARISON_WINDOW_DAYS,
): AccountSnapshot | null {
  const earlier = sortByDate(snapshots).filter(
    (snapshot) => toTime(snapshot.date) < toTime(current.date),
  );
  for (let i = earlier.length - 1; i >= 0; i -= 1) {
    if (daysBetween(current.date, earlier[i].date) >= minDaysApart) return earlier[i];
  }
  return null;
}

export interface ComparisonPair {
  /** 가장 최신 스냅샷. 없으면 null. */
  current: AccountSnapshot | null;
  /** current보다 7일 이상 앞선 비교 기준. 없으면 null. */
  baseline: AccountSnapshot | null;
}

/** 최신 스냅샷과 그 비교 기준을 한 번에 고른다. 두 모듈의 단일 진입점. */
export function comparisonPair(
  snapshots: AccountSnapshot[],
  minDaysApart: number = COMPARISON_WINDOW_DAYS,
): ComparisonPair {
  const sorted = sortByDate(snapshots);
  const current = sorted[sorted.length - 1] ?? null;
  if (current === null) return { current: null, baseline: null };
  return { current, baseline: findComparisonSnapshot(sorted, current, minDaysApart) };
}
