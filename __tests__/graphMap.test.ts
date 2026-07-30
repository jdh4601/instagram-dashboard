import { flattenInsights, mapMediaToReel } from "@/lib/graph/map";

test("flattenInsights는 Graph 인사이트 배열을 metric→value 맵으로 변환", () => {
  const data = {
    data: [
      { name: "reach", values: [{ value: 9000 }] },
      { name: "likes", values: [{ value: 300 }] },
      { name: "ig_reels_avg_watch_time", values: [{ value: 20000 }] },
    ],
  };
  const m = flattenInsights(data);
  expect(m.reach).toBe(9000);
  expect(m.ig_reels_avg_watch_time).toBe(20000);
});

// 실제 Graph v23.0이 돌려주는 dimension_value는 FOLLOWER / NON_FOLLOWER다.
// "UNFOLLOWER"는 존재하지 않는다 — 그 값으로 검증하면 NON_FOLLOWER가 follows를
// 덮어쓰는 버그를 잡지 못한다.
test("flattenInsights는 total_value와 팔로우 breakdown을 정규화", () => {
  const data = {
    data: [
      { name: "reach", total_value: { value: 900 } },
      { name: "follows_and_unfollows", total_value: { breakdowns: [{ results: [
        { dimension_values: ["FOLLOWER"], value: 12 },
        { dimension_values: ["NON_FOLLOWER"], value: 3 },
      ] }] } },
    ],
  };
  expect(flattenInsights(data)).toMatchObject({ reach: 900, follows: 12, unfollows: 3 });
});

// 익명화한 실제 응답 형태. NON_FOLLOWER는 "unfollow"를 포함하지 않아 follows
// 분기로 새고, 팔로우 값을 언팔로우 값으로 덮어쓰는 회귀가 있었다.
test("flattenInsights는 NON_FOLLOWER를 follows로 오인하지 않는다", () => {
  const real = {
    data: [
      {
        name: "follows_and_unfollows",
        total_value: {
          breakdowns: [
            {
              dimension_keys: ["follow_type"],
              results: [
                { dimension_values: ["FOLLOWER"], value: 27 },
                { dimension_values: ["NON_FOLLOWER"], value: 4 },
              ],
            },
          ],
        },
      },
    ],
  };
  expect(flattenInsights(real)).toEqual({ follows: 27, unfollows: 4 });
});

test("mapMediaToReel은 집계 지표를 Reel로 매핑(평균시청 ms→초)", () => {
  const media = {
    id: "media-1",
    media_type: "VIDEO",
    media_product_type: "REELS",
    caption: "창업 인터뷰",
    timestamp: "2026-06-01T00:00:00+0000",
  };
  const insights = {
    views: 10000, reach: 9000, likes: 300, comments: 12, saved: 40, shares: 170,
    ig_reels_avg_watch_time: 20000,
    ig_reels_video_view_total_time: 200000000,
    clips_replays_count: 1100,
    follows: 45,
    profile_visits: 180,
  };
  const reel = mapMediaToReel(media, insights, "REELS");
  expect(reel.id).toBe("media-1");
  expect(reel.views).toBe(10000);
  expect(reel.saves).toBe(40); // saved → saves
  expect(reel.avgWatchTimeSec).toBeCloseTo(20, 5); // 20000ms → 20s
  expect(reel.totalWatchTimeSec).toBe(200000);
  expect(reel.replays).toBe(1100);
  expect(reel.followsFromReel).toBe(45);
  expect(reel.caption).toBe("창업 인터뷰");
  expect(reel.durationSec).toBe(0); // API가 길이를 안 줌
});

test("mapMediaToReel은 reels_skip_rate와 출처를 매핑", () => {
  const media = { id: "m4", media_product_type: "REELS", timestamp: "2026-06-04T00:00:00+0000" };
  const reel = mapMediaToReel(media, { reels_skip_rate: 68.56 }, "REELS");
  expect(reel.skipRate).toBeCloseTo(68.56, 5);
  expect(reel.skipRateSource).toBe("API");
  expect(reel.hookRetention3s).toBeCloseTo(31.44, 5);
});

test("mapMediaToReel은 skip 지표가 없으면 skipRate/hookRetention3s를 남기지 않는다", () => {
  const media = { id: "m5", media_product_type: "REELS", timestamp: "2026-06-05T00:00:00+0000" };
  const reel = mapMediaToReel(media, {}, "REELS");
  expect(reel.skipRate).toBeUndefined();
  expect(reel.hookRetention3s).toBeUndefined();
});

test("mapMediaToReel은 썸네일/퍼머링크를 매핑", () => {
  const media = {
    id: "m3",
    media_product_type: "REELS",
    timestamp: "2026-06-03T00:00:00+0000",
    thumbnail_url: "https://cdn/thumb.jpg",
    permalink: "https://instagram.com/reel/abc",
  };
  const reel = mapMediaToReel(media, {}, "REELS");
  expect(reel.thumbnailUrl).toBe("https://cdn/thumb.jpg");
  expect(reel.permalink).toBe("https://instagram.com/reel/abc");
});

test("mapMediaToReel은 누락 지표를 0으로 채운다", () => {
  const media = { id: "m2", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-06-02T00:00:00+0000" };
  const reel = mapMediaToReel(media, {}, "REELS");
  expect(reel.views).toBe(0);
  expect(reel.likes).toBe(0);
});
