import { findPostForAdUnit, permalinkShortcode } from "@/lib/analysis/adUnitJoin";
import type { AdUnit } from "@/lib/ads/adUnit";
import type { Reel } from "@/lib/schemas";

function unit(over: Partial<AdUnit> = {}): AdUnit {
  return {
    adId: "ad1",
    name: "광고",
    status: "ACTIVE",
    spend: 1000,
    impressions: 100,
    reach: 90,
    clicks: 10,
    goal: "THRUPLAY",
    results: null,
    costPerResult: null,
    budget: null,
    activity: [],
    engagements: null,
    hasDelivery: true,
    ...over,
  };
}

function reel(id: string, permalink?: string): Reel {
  return {
    id,
    mediaType: "REELS",
    postedAt: "2026-08-31T00:00:00Z",
    durationSec: 30,
    views: 2519,
    reach: 2000,
    likes: 100,
    comments: 4,
    saves: 30,
    shares: 20,
    avgWatchTimeSec: 10,
    permalink,
  };
}

test("게시물 id가 맞으면 그 게시물을 잇는다", () => {
  const post = findPostForAdUnit(unit({ mediaId: "18159331198493386" }), [
    reel("18004506956968858"),
    reel("18159331198493386"),
  ]);

  expect(post?.id).toBe("18159331198493386");
});

// 실측한 광고가 이 경우였다. creative의 게시물 id가 우리가 동기화한 id와 다른
// 공간에 있어서, id만 믿으면 이을 수 있는 광고까지 못 잇는다.
test("게시물 id가 안 맞으면 permalink 코드로 한 번 더 맞춰 본다", () => {
  const post = findPostForAdUnit(
    unit({
      mediaId: "18102344906618669",
      permalink: "https://www.instagram.com/p/DcxC6IEsVvd/",
    }),
    [
      reel("18004506956968858", "https://www.instagram.com/reel/DaHTOWLh-Jw/"),
      reel("18159331198493386", "https://www.instagram.com/reel/DcxC6IEsVvd/"),
    ],
  );

  // 광고는 /p/ 경로로, 게시물은 /reel/ 경로로 오지만 가리키는 것은 같은 게시물이다.
  expect(post?.id).toBe("18159331198493386");
});

test("어느 쪽으로도 못 맞추면 잇지 않는다", () => {
  expect(findPostForAdUnit(unit({ mediaId: "없는id" }), [reel("18004506956968858")])).toBeNull();
  expect(findPostForAdUnit(unit(), [reel("18004506956968858")])).toBeNull();
});

test("permalink에서 게시물 코드만 떼어 낸다", () => {
  expect(permalinkShortcode("https://www.instagram.com/p/DcxC6IEsVvd/")).toBe("DcxC6IEsVvd");
  expect(permalinkShortcode("https://www.instagram.com/reel/DaHTOWLh-Jw/")).toBe("DaHTOWLh-Jw");
  expect(permalinkShortcode("https://www.instagram.com/reel/DaHTOWLh-Jw/?igsh=x")).toBe(
    "DaHTOWLh-Jw",
  );
  expect(permalinkShortcode(undefined)).toBeNull();
  expect(permalinkShortcode("https://example.com/")).toBeNull();
});
