import { createGraphClient } from "@/lib/graph/client";
import { classifyMedia, mapMediaToReel } from "@/lib/graph/map";

function fakeFetch(routes: Record<string, unknown>, calls: string[] = []) {
  return async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error("unexpected url: " + url);
    return {
      ok: true,
      json: async () => routes[key],
      text: async () => JSON.stringify(routes[key]),
    };
  };
}

test("classifyMedia는 릴스와 캐러셀만 분류하고 나머지는 null", () => {
  const ts = "2026-06-01T00:00:00+0000";
  expect(classifyMedia({ id: "a", media_product_type: "REELS", timestamp: ts })).toBe("REELS");
  expect(
    classifyMedia({ id: "b", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", timestamp: ts }),
  ).toBe("CAROUSEL");
  expect(classifyMedia({ id: "c", media_type: "IMAGE", media_product_type: "FEED", timestamp: ts })).toBeNull();
});

test("listMedia는 릴스와 캐러셀을 함께 반환하고 단일 사진 글은 제외한다", async () => {
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: fakeFetch({
      "/me/media": {
        data: [
          { id: "reel", media_product_type: "REELS", timestamp: "2026-06-01T00:00:00+0000" },
          { id: "carousel", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", timestamp: "2026-06-02T00:00:00+0000" },
          { id: "photo", media_type: "IMAGE", media_product_type: "FEED", timestamp: "2026-06-03T00:00:00+0000" },
        ],
      },
    }) as unknown as typeof fetch,
  });

  const media = await client.listMedia();
  expect(media.map((m) => m.id)).toEqual(["reel", "carousel"]);
});

test("listMedia는 캐러셀 썸네일용으로 media_url도 요청한다", async () => {
  const calls: string[] = [];
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: fakeFetch({ "/me/media": { data: [] } }, calls) as unknown as typeof fetch,
  });

  await client.listMedia();
  expect(calls[0]).toContain("media_url");
});

test("캐러셀 인사이트는 릴스 전용 지표를 요청하지 않는다", async () => {
  const calls: string[] = [];
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: fakeFetch(
      { "/insights": { data: [{ name: "reach", values: [{ value: 500 }] }] } },
      calls,
    ) as unknown as typeof fetch,
  });

  await client.getInsights("carousel-1", "CAROUSEL");

  const requested = calls.join(" ");
  expect(requested).not.toContain("ig_reels_avg_watch_time");
  expect(requested).not.toContain("reels_skip_rate");
  expect(requested).not.toContain("clips_replays_count");
  expect(requested).toContain("reach");
});

test("mapMediaToReel은 캐러셀에 mediaType을 심고 영상 지표를 비운다", () => {
  const reel = mapMediaToReel(
    {
      id: "carousel",
      media_type: "CAROUSEL_ALBUM",
      media_product_type: "FEED",
      timestamp: "2026-06-02T00:00:00+0000",
      media_url: "https://cdn/first-slide.jpg",
    },
    { reach: 500, likes: 30, comments: 2, saved: 8, shares: 4, views: 700 },
    "CAROUSEL",
  );

  expect(reel.mediaType).toBe("CAROUSEL");
  expect(reel.reach).toBe(500);
  expect(reel.views).toBe(700);
  expect(reel.thumbnailUrl).toBe("https://cdn/first-slide.jpg");
  expect(reel.avgWatchTimeSec).toBe(0);
  expect(reel.durationSec).toBe(0);
  expect(reel.skipRate).toBeUndefined();
  expect(reel.hookRetention3s).toBeUndefined();
});

test("mapMediaToReel은 릴스에 mediaType REELS를 심는다", () => {
  const reel = mapMediaToReel(
    { id: "reel", media_product_type: "REELS", timestamp: "2026-06-01T00:00:00+0000", thumbnail_url: "https://cdn/thumb.jpg" },
    { views: 1000, reach: 800, likes: 10, comments: 1, saved: 2, shares: 3, reels_skip_rate: 40 },
    "REELS",
  );

  expect(reel.mediaType).toBe("REELS");
  expect(reel.thumbnailUrl).toBe("https://cdn/thumb.jpg");
  expect(reel.hookRetention3s).toBe(60);
});
