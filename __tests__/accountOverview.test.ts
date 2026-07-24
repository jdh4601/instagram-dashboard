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
    { date: "2026-06-22", followerCount: 230, reachLast7d: 4000 },
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
  expect(o.deltas.followers).toEqual({ absolute: 8, relativePercent: (8 / 230) * 100 });
  expect(o.deltas.reachLast7d).toEqual({ absolute: 200, relativePercent: 5 });
});

// 07-21 스냅샷은 07-22에서 하루 전이라 비교 기준이 될 수 없다. 7일 이상 앞선
// 07-14를 건너뛰지 않고 골라야 한다.
test("최신 스냅샷의 모든 계정 지표를 7일 전 스냅샷과 비교", () => {
  const o = buildAccountOverview([], [
    {
      date: "2026-07-14",
      followerCount: 260,
      reachLast7d: 2800,
      viewsLast7d: 8000,
      accountsEngagedLast7d: 60,
      totalInteractionsLast7d: 160,
      followsLast7d: 8,
      availableMetrics: ["reach"],
    },
    {
      date: "2026-07-21",
      followerCount: 277,
      reachLast7d: 3192,
      viewsLast7d: 8290,
      accountsEngagedLast7d: 63,
      totalInteractionsLast7d: 174,
      followsLast7d: 7,
      availableMetrics: ["reach"],
    },
    {
      date: "2026-07-22",
      followerCount: 279,
      reachLast7d: 3589,
      viewsLast7d: 9832,
      accountsEngagedLast7d: 74,
      totalInteractionsLast7d: 205,
      followsLast7d: 9,
      availableMetrics: ["reach"],
    },
  ], null);

  expect(o.deltas.followers?.absolute).toBe(279 - 260);
  expect(o.deltas.reachLast7d?.absolute).toBe(3589 - 2800);
  expect(o.deltas.reachLast7d?.relativePercent).toBeCloseTo((789 / 2800) * 100, 5);
  expect(o.deltas.viewsLast7d?.absolute).toBe(9832 - 8000);
  expect(o.deltas.accountsEngagedLast7d?.absolute).toBe(74 - 60);
  expect(o.deltas.totalInteractionsLast7d?.absolute).toBe(205 - 160);
  expect(o.deltas.followConversionRateLast7d?.absolute).toBeCloseTo(
    (9 / 3589) * 100 - (8 / 2800) * 100,
    5,
  );
});

test("비교 기준값이 0이면 절대 변화만 제공하고 없는 지표는 비교하지 않음", () => {
  const o = buildAccountOverview([], [
    {
      date: "2026-07-15",
      followerCount: 0,
      reachLast7d: 0,
      viewsLast7d: 0,
      availableMetrics: ["reach"],
    },
    {
      date: "2026-07-22",
      followerCount: 10,
      reachLast7d: 100,
      viewsLast7d: 50,
      accountsEngagedLast7d: 5,
      availableMetrics: ["reach"],
    },
  ], null);

  expect(o.deltas.followers).toEqual({ absolute: 10, relativePercent: null });
  expect(o.deltas.reachLast7d).toEqual({ absolute: 100, relativePercent: null });
  expect(o.deltas.viewsLast7d).toEqual({ absolute: 50, relativePercent: null });
  expect(o.deltas.accountsEngagedLast7d).toBeNull();
  expect(o.deltas.totalInteractionsLast7d).toBeNull();
  expect(o.deltas.followConversionRateLast7d).toBeNull();
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
    followConversionRateLast7d: 0.6,
    followConversionSource: "api",
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
  expect(o.followConversionRateLast7d).toBeNull();
});

test("팔로우 전환율은 최근 7일 follows / reach로 계산", () => {
  const o = buildAccountOverview([], [{
    date: "2026-07-05",
    followerCount: 250,
    reachLast7d: 4000,
    followsLast7d: 20,
  }], null);

  expect(o.followConversionRateLast7d).toBeCloseTo(0.5, 5);
  expect(o.followConversionSource).toBe("api");
});

test("API follows가 없으면 7일 팔로워 순증가 / reach로 추정", () => {
  const o = buildAccountOverview([], [
    { date: "2026-06-28", followerCount: 238, reachLast7d: 0 },
    { date: "2026-07-05", followerCount: 256, reachLast7d: 3860 },
  ], null);

  expect(o.followConversionRateLast7d).toBeCloseTo((18 / 3860) * 100, 5);
  expect(o.followConversionSource).toBe("snapshot");
});

test("팔로우 데이터가 없거나 도달이 0이면 전환율을 만들지 않는다", () => {
  const missingFollows = buildAccountOverview([], [{
    date: "2026-07-05",
    followerCount: 250,
    reachLast7d: 4000,
  }], null);
  const zeroReach = buildAccountOverview([], [{
    date: "2026-07-05",
    followerCount: 250,
    reachLast7d: 0,
    followsLast7d: 20,
  }], null);

  expect(missingFollows.followConversionRateLast7d).toBeNull();
  expect(zeroReach.followConversionRateLast7d).toBeNull();
  expect(missingFollows.followConversionSource).toBeNull();
});
