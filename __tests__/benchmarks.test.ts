import { BENCHMARKS, BASELINE_MIN_REELS } from "@/config/benchmarks";

test("3초 훅 임계값은 스펙(weak<45, strong>55, weight5)과 일치한다", () => {
  expect(BENCHMARKS.hookRetention3s.weakBelow).toBe(45);
  expect(BENCHMARKS.hookRetention3s.strongAbove).toBe(55);
  expect(BENCHMARKS.hookRetention3s.weight).toBe(5);
});

test("공유율 weight는 4다", () => {
  expect(BENCHMARKS.shareRate.weight).toBe(4);
});

test("베이스라인 최소 릴스 수 상수", () => {
  expect(BASELINE_MIN_REELS).toBe(5);
});
