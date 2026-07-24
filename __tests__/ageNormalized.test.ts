import { viewsAtAge, AGE_TARGET_HOURS, buildAgeNormalizedMap } from "@/lib/analysis/ageNormalized";
import type { Reel, ReelMetricSnapshot } from "@/lib/schemas";

function reel(id: string, postedAt: string, views = 0): Reel {
  return {
    id,
    postedAt,
    durationSec: 0,
    views,
    reach: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 0,
  };
}

function snap(reelId: string, date: string, views: number): ReelMetricSnapshot {
  return { reelId, date, views, reach: 0, likes: 0, comments: 0, saves: 0, shares: 0 };
}

test("목표 시점은 48시간이다", () => {
  expect(AGE_TARGET_HOURS).toBe(48);
});

test("게시 후 48시간에 가장 가까운 기록을 고른다", () => {
  const r = reel("a", "2026-07-20T00:00:00Z");
  const history = [
    snap("a", "2026-07-21", 500), // +24h
    snap("a", "2026-07-22", 900), // +48h ← 정확히 목표
    snap("a", "2026-07-24", 1500), // +96h
  ];

  const result = viewsAtAge(r, history);
  expect(result).not.toBeNull();
  expect(result!.views).toBe(900);
  expect(result!.elapsedHours).toBe(48);
  expect(result!.date).toBe("2026-07-22");
});

test("정확한 48시간 기록이 없으면 가장 가까운 기록과 실제 경과 시간을 준다", () => {
  const r = reel("a", "2026-07-20T00:00:00Z");
  // 보간하지 않는다. 있는 값만 쓰고 몇 시간짜리인지 함께 밝힌다.
  const result = viewsAtAge(r, [snap("a", "2026-07-23", 1200)]); // +72h

  expect(result!.views).toBe(1200);
  expect(result!.elapsedHours).toBe(72);
});

test("게시 전 기록은 무시한다", () => {
  const r = reel("a", "2026-07-20T12:00:00Z");
  const result = viewsAtAge(r, [
    snap("a", "2026-07-20", 5), // 게시 12시간 전 자정 → 음수 경과
    snap("a", "2026-07-22", 800),
  ]);

  expect(result!.date).toBe("2026-07-22");
});

test("이력이 목표 시점보다 한참 뒤면 초기 성과로 볼 수 없어 null", () => {
  // 2026-06-01 게시물의 첫 기록이 06-29(28일 뒤). 48시간 수치가 아니다.
  const r = reel("old", "2026-06-01T00:00:00Z");
  expect(viewsAtAge(r, [snap("old", "2026-06-29", 3000)])).toBeNull();
});

test("이력이 없으면 0이 아니라 null", () => {
  expect(viewsAtAge(reel("a", "2026-07-20T00:00:00Z"), [])).toBeNull();
});

test("다른 게시물의 이력은 섞이지 않는다", () => {
  const r = reel("a", "2026-07-20T00:00:00Z");
  const result = viewsAtAge(r, [snap("b", "2026-07-22", 9999), snap("a", "2026-07-22", 700)]);
  expect(result!.views).toBe(700);
});

test("여러 게시물의 맵을 한 번에 만든다", () => {
  const reels = [reel("a", "2026-07-20T00:00:00Z"), reel("old", "2026-06-01T00:00:00Z")];
  const history = [snap("a", "2026-07-22", 900), snap("old", "2026-06-29", 3000)];

  const map = buildAgeNormalizedMap(reels, history);

  expect(map.a?.views).toBe(900);
  expect(map.old).toBeNull(); // 이력 없음을 명시적으로 남긴다 (키 자체는 존재)
  expect("old" in map).toBe(true);
});
