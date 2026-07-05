import { buildRetentionCurve } from "@/lib/analysis/retentionCurve";
import type { Reel } from "@/lib/schemas";

function reel(overrides: Partial<Reel>): Reel {
  return {
    id: "r1",
    postedAt: "2026-06-01T00:00:00+0000",
    durationSec: 0,
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 0,
    ...overrides,
  };
}

test("skipRate만 있으면 (0,100)·(3,100-skip) 2점 추정 곡선을 만든다", () => {
  const { curve, estimated } = buildRetentionCurve(reel({ skipRate: 69.6 }));
  expect(estimated).toBe(true);
  expect(curve).toEqual([
    { sec: 0, pct: 100 },
    { sec: 3, pct: 30.4 },
  ]);
});

test("hookRetention3s가 있으면 3초 잔존값으로 그대로 사용", () => {
  const { curve, estimated } = buildRetentionCurve(reel({ hookRetention3s: 42 }));
  expect(estimated).toBe(true);
  expect(curve[1]).toEqual({ sec: 3, pct: 42 });
});

test("실측 retentionCurve가 있으면 그대로 반환하고 estimated=false", () => {
  const measured = [
    { sec: 0, pct: 100 },
    { sec: 3, pct: 35 },
    { sec: 9, pct: 8 },
  ];
  const { curve, estimated } = buildRetentionCurve(
    reel({ retentionCurve: measured, skipRate: 60 }),
  );
  expect(estimated).toBe(false);
  expect(curve).toEqual(measured); // 실측이 API 추정보다 우선
});

test("skip 데이터도 실측 곡선도 없으면 빈 곡선", () => {
  const { curve, estimated } = buildRetentionCurve(reel({}));
  expect(curve).toEqual([]);
  expect(estimated).toBe(false);
});
