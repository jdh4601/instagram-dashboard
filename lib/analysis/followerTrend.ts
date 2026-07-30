import type { AccountSnapshot } from "@/lib/schemas";

// 날짜 오름차순 정렬 (원본 불변)
export function sortByDate(snapshots: AccountSnapshot[]): AccountSnapshot[] {
  return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
}

// 추이 차트를 그릴 최소 데이터 포인트. 2개면 직선이라 +N 증가를 과장 → 카드로.
const MIN_TREND_POINTS = 3;

export type FollowerTrendMode = "empty" | "card" | "chart";

// 데이터 수에 따른 표시 모드: 없음 / 숫자 카드 / 추이 차트
export function followerTrendMode(snapshots: AccountSnapshot[]): FollowerTrendMode {
  const n = snapshots.length;
  if (n === 0) return "empty";
  if (n < MIN_TREND_POINTS) return "card";
  return "chart";
}

// 최신 스냅샷 − 직전 스냅샷의 팔로워 차이. 2개 미만이면 null.
export function latestFollowerDelta(snapshots: AccountSnapshot[]): number | null {
  if (snapshots.length < 2) return null;
  const sorted = sortByDate(snapshots);
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  return latest.followerCount - prev.followerCount;
}
