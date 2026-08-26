import type { AccountSnapshot } from "@/lib/schemas";

// 날짜 오름차순 정렬 (원본 불변)
export function sortByDate(snapshots: AccountSnapshot[]): AccountSnapshot[] {
  return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
}

// 최신 스냅샷 − 직전 스냅샷의 팔로워 차이. 2개 미만이면 null.
export function latestFollowerDelta(snapshots: AccountSnapshot[]): number | null {
  if (snapshots.length < 2) return null;
  const sorted = sortByDate(snapshots);
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  return latest.followerCount - prev.followerCount;
}
