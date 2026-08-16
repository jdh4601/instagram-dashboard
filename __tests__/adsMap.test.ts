import { buildAdPerformance, type GraphAd, type GraphAdInsight } from "@/lib/ads/map";
import { createAdsClient } from "@/lib/ads/client";

function ad(id: string, mediaId?: string): GraphAd {
  return {
    id,
    name: `광고 ${id}`,
    effective_status: "ACTIVE",
    creative: mediaId
      ? {
          effective_instagram_media_id: mediaId,
          instagram_permalink_url: `https://www.instagram.com/p/${mediaId}/`,
        }
      : {},
  };
}

function insight(adId: string, over: Partial<GraphAdInsight> = {}): GraphAdInsight {
  return {
    ad_id: adId,
    spend: "30000",
    reach: "8000",
    impressions: "12000",
    clicks: "150",
    actions: [
      { action_type: "post_reaction", value: "120" },
      { action_type: "comment", value: "8" },
      { action_type: "post", value: "14" },
      { action_type: "onsite_conversion.post_save", value: "40" },
      { action_type: "link_click", value: "22" },
      { action_type: "post_engagement", value: "204" },
    ],
    ...over,
  };
}

test("광고를 effective_instagram_media_id로 오가닉 게시물에 잇는다", () => {
  const rows = buildAdPerformance([ad("a1", "18021852389697322")], [insight("a1")]);

  expect(rows).toHaveLength(1);
  expect(rows[0].mediaId).toBe("18021852389697322");
  expect(rows[0].spend).toBe(30000);
  expect(rows[0].actions!.saves).toBe(40);
  expect(rows[0].actions!.shares).toBe(14);
  expect(rows[0].permalink).toContain("instagram.com");
});

test("인스타 게시물에 붙지 않은 광고는 조인할 수 없어 버린다", () => {
  const rows = buildAdPerformance([ad("a1"), ad("a2", "111")], [insight("a1"), insight("a2")]);

  expect(rows).toHaveLength(1);
  expect(rows[0].mediaId).toBe("111");
});

test("같은 게시물을 여러 번 태우면 한 줄로 합산한다", () => {
  const rows = buildAdPerformance(
    [ad("a1", "111"), ad("a2", "111")],
    [insight("a1"), insight("a2", { spend: "20000", reach: "5000", impressions: "7000" })],
  );

  expect(rows).toHaveLength(1);
  expect(rows[0].adCount).toBe(2);
  expect(rows[0].spend).toBe(50000);
  expect(rows[0].impressions).toBe(19000);
  expect(rows[0].actions!.saves).toBe(80);
});

test("성과가 아직 없는 광고도 지출 0으로 남긴다", () => {
  const rows = buildAdPerformance([ad("a1", "111")], []);

  expect(rows).toHaveLength(1);
  expect(rows[0].spend).toBe(0);
  expect(rows[0].adCount).toBe(1);
});

// 모르는 행동 키를 참여로 뭉뚱그리면 참여 단가가 조용히 부풀어 광고가 실제보다
// 좋아 보인다. 확신하는 키만 옮긴다.
test("모르는 행동 유형은 참여에 섞지 않는다", () => {
  const rows = buildAdPerformance(
    [ad("a1", "111")],
    [
      {
        ad_id: "a1",
        spend: "1000",
        actions: [
          { action_type: "onsite_conversion.post_save", value: "5" },
          { action_type: "landing_page_view", value: "999" },
          { action_type: "video_view", value: "888" },
        ],
      },
    ],
  );

  expect(rows[0].actions!.saves).toBe(5);
  expect(rows[0].actions!.totalEngagement).toBe(0);
  expect(rows[0].actions!.likes).toBe(0);
});

test("지출이 큰 게시물이 먼저 온다", () => {
  const rows = buildAdPerformance(
    [ad("a1", "111"), ad("a2", "222")],
    [insight("a1", { spend: "10000" }), insight("a2", { spend: "90000" })],
  );

  expect(rows.map((r) => r.mediaId)).toEqual(["222", "111"]);
});

function fakeFetch(routes: Array<[string, unknown]>, seen?: string[]) {
  return async (url: string) => {
    seen?.push(url);
    const hit = routes.find(([k]) => url.includes(k));
    if (!hit) throw new Error("unexpected url");
    return { ok: true, json: async () => hit[1] };
  };
}

test("listAdPerformance는 광고 목록과 성과를 같은 기간으로 따로 받아 맞물린다", async () => {
  const seen: string[] = [];
  const client = createAdsClient({
    accessToken: "T",
    fetchImpl: fakeFetch(
      [
        ["/insights", { data: [insight("a1")] }],
        ["/ads", { data: [ad("a1", "111")] }],
      ],
      seen,
    ),
  });

  const rows = await client.listAdPerformance("act_1", { since: "2026-07-16", until: "2026-08-15" });

  expect(rows[0].mediaId).toBe("111");
  expect(rows[0].spend).toBe(30000);
  const insightsCall = seen.find((u) => u.includes("/insights"));
  expect(insightsCall).toContain("level=ad");
  expect(decodeURIComponent(insightsCall!)).toContain('{"since":"2026-07-16","until":"2026-08-15"}');
});

test("오류 메시지에 토큰을 흘리지 않는다", async () => {
  const client = createAdsClient({
    accessToken: "SECRET",
    fetchImpl: async () => ({
      ok: false,
      json: async () => ({ error: { message: "bad token SECRET", code: 190 } }),
    }),
  });

  await expect(client.listAdAccounts()).rejects.toThrow(/REDACTED/);
  await expect(client.listAdAccounts()).rejects.not.toThrow(/SECRET/);
});
