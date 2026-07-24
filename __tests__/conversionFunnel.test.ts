import { buildConversionFunnel } from "@/lib/analysis/conversionFunnel";
import type { Reel } from "@/lib/schemas";

const NOW = "2026-07-24T12:00:00Z";

function post(overrides: Partial<Reel> & { id: string; postedAt: string }): Reel {
  return {
    mediaType: "CAROUSEL",
    durationSec: 0,
    views: 1000,
    reach: 800,
    likes: 10,
    comments: 1,
    saves: 3,
    shares: 5,
    avgWatchTimeSec: 0,
    ...overrides,
  };
}

test("최근 7일 게시물의 도달·프로필 방문·팔로우를 합산한다", () => {
  const f = buildConversionFunnel(
    [
      post({ id: "a", postedAt: "2026-07-24T00:00:00Z", reach: 100, profileVisits: 10, followsFromReel: 2 }),
      post({ id: "b", postedAt: "2026-07-20T00:00:00Z", reach: 300, profileVisits: 20, followsFromReel: 3 }),
    ],
    NOW,
  );

  expect(f.postCount).toBe(2);
  expect(f.reach).toBe(400);
  expect(f.profileVisits).toBe(30);
  expect(f.follows).toBe(5);
  expect(f.visitRate).toBeCloseTo((30 / 400) * 100, 5);
  expect(f.followRate).toBeCloseTo((5 / 30) * 100, 5);
});

test("창 밖의 게시물은 제외한다", () => {
  const f = buildConversionFunnel(
    [
      post({ id: "in", postedAt: "2026-07-18T00:00:00Z", reach: 100, profileVisits: 5, followsFromReel: 1 }),
      post({ id: "out", postedAt: "2026-07-10T00:00:00Z", reach: 900, profileVisits: 90, followsFromReel: 9 }),
    ],
    NOW,
  );

  expect(f.postCount).toBe(1);
  expect(f.reach).toBe(100);
});

test("경계: 정확히 7일 전 게시물은 포함한다", () => {
  const f = buildConversionFunnel(
    [post({ id: "edge", postedAt: "2026-07-17T12:00:00Z", reach: 50, profileVisits: 1 })],
    NOW,
  );
  expect(f.postCount).toBe(1);
});

test("프로필 방문이 누락된 게시물을 0으로 채우지 않는다", () => {
  // 0으로 채우면 전환율이 실제보다 낮게 보인다. 누락은 누락으로 센다.
  const f = buildConversionFunnel(
    [
      post({ id: "a", postedAt: "2026-07-24T00:00:00Z", reach: 100, profileVisits: 10, followsFromReel: 1 }),
      post({ id: "b", postedAt: "2026-07-22T00:00:00Z", reach: 100 }), // profileVisits 없음
    ],
    NOW,
  );

  expect(f.postsMissingVisits).toBe(1);
  expect(f.profileVisits).toBe(10);
  // 방문 데이터가 있는 게시물의 도달로만 나눈다 — 분모에 측정 안 된 도달을 넣지 않는다.
  expect(f.visitRate).toBeCloseTo((10 / 100) * 100, 5);
});

test("모든 게시물에 방문 데이터가 없으면 방문 단계를 만들지 않는다", () => {
  const f = buildConversionFunnel(
    [post({ id: "a", postedAt: "2026-07-24T00:00:00Z", reach: 100 })],
    NOW,
  );

  expect(f.profileVisits).toBeNull();
  expect(f.visitRate).toBeNull();
  expect(f.followRate).toBeNull();
  expect(f.postsMissingVisits).toBe(1);
});

test("팔로우가 0이면 누락이 아니라 실제 0으로 센다", () => {
  // 실측 사례: 07-24 캐러셀은 프로필 방문 1, 팔로우 0이었다. 0은 데이터가 있는 것이다.
  const f = buildConversionFunnel(
    [post({ id: "a", postedAt: "2026-07-24T00:00:00Z", reach: 108, profileVisits: 1, followsFromReel: 0 })],
    NOW,
  );

  expect(f.follows).toBe(0);
  expect(f.postsMissingFollows).toBe(0);
  expect(f.followRate).toBe(0);
});

test("창 안에 게시물이 없으면 빈 퍼널을 준다", () => {
  const f = buildConversionFunnel([], NOW);
  expect(f.postCount).toBe(0);
  expect(f.reach).toBe(0);
  expect(f.profileVisits).toBeNull();
  expect(f.visitRate).toBeNull();
});

test("도달이 0이면 나눗셈을 하지 않는다", () => {
  const f = buildConversionFunnel(
    [post({ id: "a", postedAt: "2026-07-24T00:00:00Z", reach: 0, profileVisits: 0 })],
    NOW,
  );
  expect(f.visitRate).toBeNull();
});
