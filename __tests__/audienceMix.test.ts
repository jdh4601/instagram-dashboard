import { buildAudienceMix } from "@/lib/analysis/audienceMix";
import type { AccountSnapshot } from "@/lib/schemas";

function snapshot(over: Partial<AccountSnapshot> & { date: string }): AccountSnapshot {
  return { followerCount: 280, reachLast7d: 3340, ...over };
}

test("비팔로워 비중은 breakdown 합계를 분모로 쓴다", () => {
  // total_value(3340)와 breakdown 합(3349)이 어긋난다 — Graph가 추산치라고 명시한 지표다.
  const mix = buildAudienceMix([
    snapshot({ date: "2026-07-25", followerReachLast7d: 199, nonFollowerReachLast7d: 3150 }),
  ]);

  expect(mix).not.toBeNull();
  expect(mix!.total).toBe(3349);
  expect(mix!.nonFollowerShare).toBeCloseTo(94.06, 1);
  expect(mix!.date).toBe("2026-07-25");
});

test("값이 있는 가장 최근 스냅샷을 쓰고 그 날짜를 함께 돌려준다", () => {
  const mix = buildAudienceMix([
    snapshot({ date: "2026-07-18", followerReachLast7d: 100, nonFollowerReachLast7d: 100 }),
    snapshot({ date: "2026-07-22", followerReachLast7d: 50, nonFollowerReachLast7d: 150 }),
    // 최신 스냅샷은 이 지표를 수집하기 전 것이라 비어 있다
    snapshot({ date: "2026-07-25" }),
  ]);

  expect(mix!.date).toBe("2026-07-22");
  expect(mix!.nonFollowerShare).toBe(75);
});

test("수집 이력이 없으면 null이다", () => {
  expect(buildAudienceMix([snapshot({ date: "2026-07-25" })])).toBeNull();
  expect(buildAudienceMix([])).toBeNull();
});

test("도달이 0이면 비중을 계산하지 않는다", () => {
  const mix = buildAudienceMix([
    snapshot({ date: "2026-07-25", followerReachLast7d: 0, nonFollowerReachLast7d: 0 }),
  ]);

  expect(mix).toBeNull();
});

test("한쪽만 수집된 스냅샷은 쓰지 않는다", () => {
  const mix = buildAudienceMix([snapshot({ date: "2026-07-25", nonFollowerReachLast7d: 3150 })]);

  expect(mix).toBeNull();
});
