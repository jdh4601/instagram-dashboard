import { sortByDate, latestFollowerDelta } from "@/lib/analysis/followerTrend";
import type { AccountSnapshot } from "@/lib/schemas";

const snaps: AccountSnapshot[] = [
  { date: "2026-06-10", followerCount: 1200, reachLast7d: 5000 },
  { date: "2026-06-01", followerCount: 1000, reachLast7d: 4000 },
  { date: "2026-06-05", followerCount: 1100, reachLast7d: 4500 },
];

test("sortByDate는 날짜 오름차순 정렬한다", () => {
  const sorted = sortByDate(snaps);
  expect(sorted.map((s) => s.date)).toEqual(["2026-06-01", "2026-06-05", "2026-06-10"]);
});

test("latestFollowerDelta는 최신−직전 팔로워 차이", () => {
  expect(latestFollowerDelta(snaps)).toBe(100); // 1200 - 1100
});

test("스냅샷 2개 미만이면 null", () => {
  expect(latestFollowerDelta([snaps[0]])).toBeNull();
  expect(latestFollowerDelta([])).toBeNull();
});
