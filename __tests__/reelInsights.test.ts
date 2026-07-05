import { buildReelInsights } from "@/lib/analysis/reelInsights";
import type { Reel } from "@/lib/schemas";

function reel(id: string, overrides: Partial<Reel> = {}): Reel {
  return {
    id,
    postedAt: "2026-06-01T00:00:00Z",
    durationSec: 30,
    views: 1000,
    reach: 800,
    likes: 20,
    comments: 2,
    saves: 10,
    shares: 8,
    avgWatchTimeSec: 12,
    ...overrides,
  };
}

test("비교 릴스 5개 이상이면 중앙값 대비 강점을 생성", () => {
  const history = Array.from({ length: 5 }, (_, index) => reel(`h${index}`));
  const insights = buildReelInsights(reel("target", { saves: 40, shares: 30 }), history);
  expect(insights.some((insight) => insight.id === "high-intent" && insight.tone === "strength")).toBe(true);
});

test("비교 릴스가 부족하면 상대 우열 문구를 생성하지 않음", () => {
  const insights = buildReelInsights(reel("target", { saves: 40 }), [reel("h1")]);
  expect(insights.some((insight) => insight.benchmarkValue !== undefined)).toBe(false);
});

test("EDIT 비팔로워 데이터는 출처를 명시", () => {
  const insights = buildReelInsights(reel("target", { audienceBreakdown: { followersPct: 20, nonFollowersPct: 80 } }), []);
  expect(insights).toContainEqual(expect.objectContaining({ id: "non-follower-reach", source: "EDIT" }));
});
