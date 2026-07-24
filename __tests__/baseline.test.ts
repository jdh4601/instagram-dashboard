import { median, buildBaselineThresholds, deltaVsRecent } from "@/lib/analysis/baseline";
import type { Reel } from "@/lib/schemas";

function reel(id: string, hook: number, shares: number): Reel {
  return {
    id, postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
    views: 10000, reach: 9000, likes: 300, comments: 10,
    saves: 30, shares, avgWatchTimeSec: 20, hookRetention3s: hook,
  };
}

test("median 홀수/짝수", () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([1, 2, 3, 4])).toBe(2.5);
});

test("릴스 5개 미만이면 null (글로벌 임계값 사용)", () => {
  const hist = [reel("1", 50, 170), reel("2", 52, 180)];
  expect(buildBaselineThresholds(hist)).toBeNull();
});

test("릴스 5개 이상이면 중앙값 기반 임계값을 만든다", () => {
  const hist = [40, 45, 50, 55, 60].map((h, i) => reel(String(i), h, 170));
  const t = buildBaselineThresholds(hist);
  expect(t).not.toBeNull();
  // 훅 중앙값 50 → weakBelow 42.5, strongAbove 57.5
  expect(t!.hookRetention3s!.weakBelow).toBeCloseTo(42.5, 5);
  expect(t!.hookRetention3s!.strongAbove).toBeCloseTo(57.5, 5);
  expect(t!.hookRetention3s!.weight).toBe(5); // 글로벌 유지
});

test("deltaVsRecent: 현재 훅 − 최근 평균", () => {
  const current = reel("now", 55, 170);
  const recent = [reel("a", 48, 170), reel("b", 50, 170), reel("c", 52, 170)];
  expect(deltaVsRecent(current, recent, "hookRetention3s")).toBeCloseTo(5, 5); // 55-50
});
