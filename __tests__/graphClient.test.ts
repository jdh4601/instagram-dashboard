import { createGraphClient } from "@/lib/graph/client";

// URL 패턴별로 가짜 응답을 돌려주는 fetch 목
function fakeFetch(routes: Record<string, unknown>) {
  return async (url: string) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error("unexpected url: " + url);
    return {
      ok: true,
      json: async () => routes[key],
      text: async () => JSON.stringify(routes[key]),
    };
  };
}

test("getProfile은 user_id/username/followers_count/avatar/media_count를 반환", async () => {
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: fakeFetch({
      "/me?": {
        user_id: "123",
        username: "founder",
        followers_count: 1234,
        profile_picture_url: "https://cdn/avatar.jpg",
        media_count: 42,
      },
    }) as unknown as typeof fetch,
  });
  const p = await client.getProfile();
  expect(p.userId).toBe("123");
  expect(p.followersCount).toBe(1234);
  expect(p.avatarUrl).toBe("https://cdn/avatar.jpg");
  expect(p.mediaCount).toBe(42);
});

test("listMedia는 분석 대상이 아닌 피드 글을 제외한다", async () => {
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: fakeFetch({
      "/me/media": {
        data: [
          { id: "a", media_product_type: "REELS", timestamp: "2026-06-01T00:00:00+0000" },
          { id: "b", media_product_type: "FEED", timestamp: "2026-06-02T00:00:00+0000" },
        ],
      },
    }) as unknown as typeof fetch,
  });
  const { analyzable: reels } = await client.listMedia();
  expect(reels.map((m) => m.id)).toEqual(["a"]);
});

test("getInsights는 토큰을 URL에 포함하고 flatten된 맵을 반환", async () => {
  let seenUrl = "";
  const client = createGraphClient({
    accessToken: "secret-tok",
    fetchImpl: (async (url: string) => {
      seenUrl = url;
      return {
        ok: true,
        json: async () => ({ data: [{ name: "views", values: [{ value: 5000 }] }] }),
        text: async () => "",
      };
    }) as unknown as typeof fetch,
  });
  const insights = await client.getInsights("media-1");
  expect(insights.metrics.views).toBe(5000);
  expect(seenUrl).toContain("media-1/insights");
  expect(seenUrl).toContain("access_token=secret-tok");
});

test("선택 지표 묶음이 실패하면 개별 지표를 격리하고 기본 지표는 보존", async () => {
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: (async (url: string) => {
      const parsed = new URL(url);
      const metric = parsed.searchParams.get("metric") ?? "";
      if (metric.includes("views,reach")) {
        return { ok: true, json: async () => ({ data: [{ name: "views", values: [{ value: 10 }] }] }), text: async () => "" };
      }
      if (metric === "follows") {
        return { ok: true, json: async () => ({ data: [{ name: "follows", values: [{ value: 2 }] }] }), text: async () => "" };
      }
      return { ok: false, json: async () => ({ error: { message: "unsupported" } }), text: async () => "" };
    }) as unknown as typeof fetch,
  });

  const result = await client.getInsights("m1");
  expect(result.metrics).toMatchObject({ views: 10, follows: 2 });
  expect(result.availableMetrics).toContain("follows");
  expect(result.unavailableMetrics).toContain("profile_visits");
});

test("getInsights는 reels_skip_rate를 요청하고 반환값을 metrics로 전달", async () => {
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: (async (url: string) => {
      const metric = new URL(url).searchParams.get("metric") ?? "";
      if (metric.includes("views,reach")) {
        return { ok: true, json: async () => ({ data: [{ name: "views", values: [{ value: 10 }] }] }), text: async () => "" };
      }
      if (!metric.includes("reels_skip_rate")) throw new Error("reels_skip_rate 미요청");
      return { ok: true, json: async () => ({ data: [{ name: "reels_skip_rate", values: [{ value: 68.56 }] }] }), text: async () => "" };
    }) as unknown as typeof fetch,
  });

  const result = await client.getInsights("m1");
  expect(result.metrics.reels_skip_rate).toBeCloseTo(68.56, 5);
  expect(result.availableMetrics).toContain("reels_skip_rate");
});

test("API 오류(ok=false)면 throw", async () => {
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: (async () => ({
      ok: false,
      json: async () => ({ error: { message: "Invalid OAuth access token" } }),
      text: async () => '{"error":{"message":"Invalid OAuth access token"}}',
    })) as unknown as typeof fetch,
  });
  await expect(client.getProfile()).rejects.toThrow(/Invalid OAuth/);
});
