import { buildStandardsGaps } from "@/lib/analysis/standardsGaps";
import type { Reel } from "@/lib/schemas";

function reel(id: string, over: Partial<Reel> = {}): Reel {
  return {
    id,
    postedAt: "2026-06-01T00:00:00Z",
    mediaType: "REELS",
    durationSec: 50,
    views: 10000,
    reach: 9000,
    likes: 300,
    comments: 5,
    saves: 20,
    shares: 170,
    avgWatchTimeSec: 20,
    hookRetention3s: 50,
    ...over,
  };
}

test("포맷별로 절대 기준 미달 지표를 모은다", () => {
  // 캐러셀 저장율이 기준(1%)에 크게 못 미치는 실제 상황
  const carousels = Array.from({ length: 4 }, (_, i) =>
    reel(`c${i}`, { mediaType: "CAROUSEL", saves: 13, reach: 9000, hookRetention3s: undefined }),
  );
  const gaps = buildStandardsGaps(carousels);

  const carousel = gaps.find((g) => g.kind === "CAROUSEL");
  expect(carousel).toBeDefined();
  expect(carousel!.label).toBe("캐러셀");
  expect(carousel!.diagnosis.weaknesses.map((v) => v.key)).toContain("saveRate");
});

test("기준을 만족하는 포맷은 목록에 넣지 않는다", () => {
  // 모든 지표가 강점권인 릴스
  const strong = Array.from({ length: 4 }, (_, i) =>
    reel(`r${i}`, { hookRetention3s: 70, shares: 400, saves: 200, comments: 40, likes: 400, followsFromReel: 200 }),
  );
  const gaps = buildStandardsGaps(strong);

  expect(gaps.find((g) => g.kind === "REELS")).toBeUndefined();
});

test("해당 포맷 게시물이 없으면 건너뛴다", () => {
  const onlyReels = [reel("r0", { saves: 8 })];
  const gaps = buildStandardsGaps(onlyReels);

  expect(gaps.every((g) => g.kind !== "CAROUSEL")).toBe(true);
});

test("게시물이 아예 없으면 빈 배열", () => {
  expect(buildStandardsGaps([])).toEqual([]);
});
