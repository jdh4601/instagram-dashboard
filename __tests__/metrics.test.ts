import { computeDerivedRates } from "@/lib/analysis/metrics";
import type { Reel } from "@/lib/schemas";

const base: Reel = {
  id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
  views: 10000, reach: 9000, likes: 300, comments: 12,
  saves: 40, shares: 170, avgWatchTimeSec: 20,
};

test("공유율 = shares/views*100", () => {
  expect(computeDerivedRates(base).shareRate).toBeCloseTo(1.7, 5);
});

test("완료율 = avgWatchTime/duration*100", () => {
  expect(computeDerivedRates(base).completionRate).toBeCloseTo(40, 5);
});

test("engagementRate = (likes+comments+saves+shares)/views*100", () => {
  expect(computeDerivedRates(base).engagementRate).toBeCloseTo(5.22, 5);
});

test("followsFromReel 있으면 followRate 계산", () => {
  const r = { ...base, followsFromReel: 50 };
  expect(computeDerivedRates(r).followRate).toBeCloseTo(0.5, 5);
});

test("followsFromReel 없으면 followRate undefined", () => {
  expect(computeDerivedRates(base).followRate).toBeUndefined();
});

test("views가 0이면 모든 비율 0 (0 나눗셈 방어)", () => {
  const r = { ...base, views: 0 };
  const d = computeDerivedRates(r);
  expect(d.shareRate).toBe(0);
  expect(d.engagementRate).toBe(0);
});

test("팔로우 전환율(followConversionRate) = followsFromReel / reach × 100", () => {
  const r = { ...base, followsFromReel: 45 };
  expect(computeDerivedRates(r).followConversionRate).toBeCloseTo(0.5, 5);
});

test("프로필 방문률(profileVisitRate) = profileVisits / reach × 100", () => {
  const r = { ...base, profileVisits: 180 };
  expect(computeDerivedRates(r).profileVisitRate).toBeCloseTo(2, 5);
});

test("followsFromReel, profileVisits 누락 시 해당 derived 필드는 undefined", () => {
  const d = computeDerivedRates(base);
  expect(d.followConversionRate).toBeUndefined();
  expect(d.profileVisitRate).toBeUndefined();
});

test("도달 기반 참여·고의도·재생 지표를 계산", () => {
  const d = computeDerivedRates({ ...base, totalInteractions: 600, replays: 1000 });
  expect(d.interactionRateByReach).toBeCloseTo(600 / 9000 * 100, 5);
  expect(d.highIntentRate).toBeCloseTo((40 + 170) / 9000 * 100, 5);
  expect(d.playsPerReachedAccount).toBeCloseTo(10000 / 9000, 5);
  expect(d.replayRate).toBeCloseTo(10, 5);
});

test("총 시청시간과 프로필 퍼널을 계산", () => {
  const d = computeDerivedRates({ ...base, totalWatchTimeSec: 200000, profileVisits: 180, followsFromReel: 45 });
  expect(d.watchTimePerView).toBe(20);
  expect(d.profileToFollowRate).toBe(25);
  expect(d.averageWatchPercentage).toBe(40);
});

test("평균 시청 비율은 반복 시청을 숨기지 않고 100% 초과를 보존", () => {
  expect(computeDerivedRates({ ...base, avgWatchTimeSec: 75 }).averageWatchPercentage).toBe(150);
});

test("분모가 0이면 선택 파생 지표는 undefined", () => {
  const d = computeDerivedRates({ ...base, views: 0, reach: 0, totalInteractions: 0, replays: 0 });
  expect(d.interactionRateByReach).toBeUndefined();
  expect(d.playsPerReachedAccount).toBeUndefined();
  expect(d.replayRate).toBeUndefined();
});
