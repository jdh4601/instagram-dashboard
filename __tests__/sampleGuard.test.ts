import { diagnose } from "@/lib/analysis/diagnosis";
import { MIN_REACH_FOR_VERDICT } from "@/config/benchmarks";
import type { Reel } from "@/lib/schemas";

// 2026-07-24 캐러셀 실측: 조회 470 / 도달 108. 비율은 좋아 보이지만 도달이
// 평균의 1/4이라 판정 근거가 없다.
function lowReach(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "c1",
    mediaType: "CAROUSEL",
    postedAt: "2026-07-24T00:00:00Z",
    durationSec: 0,
    views: 470,
    reach: 108,
    likes: 6,
    comments: 1,
    saves: 3,
    shares: 7,
    avgWatchTimeSec: 0,
    ...overrides,
  };
}

test("판정 최소 도달은 300이다", () => {
  expect(MIN_REACH_FOR_VERDICT).toBe(300);
});

test("도달이 최소 표본에 못 미치면 판정을 보류한다", () => {
  const d = diagnose(lowReach());

  expect(d.insufficientSample).toBe(true);
  expect(d.bottleneck).toBeNull();
  expect(d.strengths).toEqual([]);
  expect(d.weaknesses).toEqual([]);
});

test("표본이 부족해도 측정값 자체는 남긴다", () => {
  // 막대 그래프는 그려야 한다. 숨기는 것과 판정하지 않는 것은 다르다.
  const d = diagnose(lowReach());
  expect(d.verdicts.length).toBeGreaterThan(0);
  expect(d.verdicts.map((v) => v.key)).toContain("shareRate");
});

test("비율이 아무리 좋아도 표본이 부족하면 강점이 되지 않는다", () => {
  // 공유 50 / 조회 100 = 50% — 정상 표본이면 확실한 강점이다.
  const d = diagnose(lowReach({ views: 100, shares: 50, reach: 99 }));
  expect(d.strengths).toEqual([]);
  expect(d.insufficientSample).toBe(true);
});

test("도달이 최소 표본 이상이면 기존 판정이 그대로 동작한다", () => {
  const d = diagnose(lowReach({ reach: MIN_REACH_FOR_VERDICT, views: 1000, saves: 2 }));

  expect(d.insufficientSample).toBe(false);
  // 저장 2 / 조회 1000 = 0.2% → 캐러셀 하한 1% 미달
  expect(d.weaknesses.map((v) => v.key)).toContain("saveRate");
  expect(d.bottleneck).not.toBeNull();
});

test("안내 문구에 쓸 실제 도달값을 함께 준다", () => {
  expect(diagnose(lowReach()).reach).toBe(108);
});
