import { buildAccountOverview } from "@/lib/analysis/accountOverview";
import type { Reel, AccountSnapshot, AccountProfile } from "@/lib/schemas";

function reel(id: string, engagementRate: number): Reel {
  return {
    id,
    postedAt: "2026-06-01T00:00:00+0000",
    durationSec: 0,
    views: 1000,
    reach: 900,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 0,
    derived: {
      shareRate: 0,
      saveRate: 0,
      likeRate: 0,
      commentRate: 0,
      engagementRate,
      completionRate: 0,
    },
  };
}

const profile: AccountProfile = {
  username: "founder",
  followersCount: 238,
  mediaCount: 12,
  updatedAt: "2026-06-29",
};

test("프로필 팔로워/릴스 수와 평균 인게이지먼트를 집계", () => {
  const reels = [reel("a", 2), reel("b", 4)];
  const snaps: AccountSnapshot[] = [
    { date: "2026-06-28", followerCount: 230, reachLast7d: 4000 },
    { date: "2026-06-29", followerCount: 238, reachLast7d: 4200 },
  ];
  const o = buildAccountOverview(reels, snaps, profile);
  expect(o.followers).toBe(238);
  expect(o.followerDelta).toBe(8);
  expect(o.reachLast7d).toBe(4200);
  expect(o.reachAvailable).toBe(true);
  expect(o.reelCount).toBe(12); // 프로필 우선
  expect(o.avgEngagementRate).toBeCloseTo(3, 5);
  expect(o.viewsLast7d).toBeNull();
});

test("최신 계정 인사이트를 상단 개요로 전달", () => {
  const o = buildAccountOverview([], [{
    date: "2026-07-05",
    followerCount: 250,
    reachLast7d: 5000,
    viewsLast7d: 7000,
    accountsEngagedLast7d: 400,
    totalInteractionsLast7d: 600,
    followsLast7d: 30,
    unfollowsLast7d: 8,
    profileLinksTapsLast7d: 12,
  }], null);
  expect(o).toMatchObject({
    viewsLast7d: 7000,
    accountsEngagedLast7d: 400,
    totalInteractionsLast7d: 600,
    netFollowersLast7d: 22,
    profileLinksTapsLast7d: 12,
  });
});

test("프로필이 없으면 스냅샷/릴스에서 추론", () => {
  const reels = [reel("a", 5)];
  const snaps: AccountSnapshot[] = [{ date: "2026-06-29", followerCount: 100, reachLast7d: 500 }];
  const o = buildAccountOverview(reels, snaps, null);
  expect(o.followers).toBe(100);
  expect(o.followerDelta).toBeNull();
  expect(o.reelCount).toBe(1); // 릴스 개수로 대체
  expect(o.avgEngagementRate).toBeCloseTo(5, 5);
});

test("데이터가 비면 0/null로 안전 처리", () => {
  const o = buildAccountOverview([], [], null);
  expect(o.followers).toBe(0);
  expect(o.followerDelta).toBeNull();
  expect(o.reachLast7d).toBe(0);
  expect(o.reachAvailable).toBe(false);
  expect(o.reelCount).toBe(0);
  expect(o.avgEngagementRate).toBe(0);
});

test("API가 reach를 지원하면 실제 0도 수집값으로 구분", () => {
  const o = buildAccountOverview([], [{
    date: "2026-07-05",
    followerCount: 0,
    reachLast7d: 0,
    availableMetrics: ["reach"],
  }], null);
  expect(o.reachLast7d).toBe(0);
  expect(o.reachAvailable).toBe(true);
});
