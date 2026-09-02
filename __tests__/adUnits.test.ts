import {
  buildAdUnits,
  budgetToMajorUnit,
  type GraphAdSet,
  type GraphCampaign,
} from "@/lib/ads/adUnit";
import type { GraphAd, GraphAdInsight } from "@/lib/ads/map";

function ad(over: Partial<GraphAd> = {}): GraphAd {
  return {
    id: "120253915877380651",
    name: 'Post: "Ep 5. 제품보다 먼저 갖춰야 할 창업가의 자질"',
    effective_status: "ACTIVE",
    created_time: "2026-09-02T10:21:23+0900",
    adset_id: "120253915876410651",
    campaign_id: "120253915876260651",
    creative: {
      effective_instagram_media_id: "18102344906618669",
      instagram_permalink_url: "https://www.instagram.com/p/DcxC6IEsVvd/",
      thumbnail_url: "https://scontent.example/thumb.jpg",
    },
    ...over,
  };
}

function adset(over: Partial<GraphAdSet> = {}): GraphAdSet {
  return {
    id: "120253915876410651",
    optimization_goal: "THRUPLAY",
    start_time: "2026-09-02T10:21:48+0900",
    end_time: "2026-09-04T10:21:48+0900",
    effective_status: "ACTIVE",
    ...over,
  };
}

function insight(over: Partial<GraphAdInsight> = {}): GraphAdInsight {
  return {
    ad_id: "120253915877380651",
    spend: "3427",
    reach: "600",
    impressions: "698",
    clicks: "85",
    ...over,
  };
}

test("광고와 광고 세트와 성과를 한 줄로 맞물린다", () => {
  const [unit] = buildAdUnits({
    ads: [ad()],
    adsets: [adset()],
    campaigns: [],
    insights: [insight()],
    currency: "KRW",
  });

  expect(unit.adId).toBe("120253915877380651");
  expect(unit.name).toContain("Ep 5.");
  expect(unit.status).toBe("ACTIVE");
  expect(unit.mediaId).toBe("18102344906618669");
  expect(unit.permalink).toBe("https://www.instagram.com/p/DcxC6IEsVvd/");
  expect(unit.thumbnailUrl).toBe("https://scontent.example/thumb.jpg");
  // Business Suite의 Views는 노출이고 Viewers는 도달이다.
  expect(unit.impressions).toBe(698);
  expect(unit.reach).toBe(600);
  expect(unit.spend).toBe(3427);
  expect(unit.goal).toBe("THRUPLAY");
  expect(unit.startTime).toBe("2026-09-02T10:21:48+0900");
  expect(unit.endTime).toBe("2026-09-04T10:21:48+0900");
  expect(unit.hasDelivery).toBe(true);
});

// 오늘 실측한 상태다 — 광고는 계정에 올라왔는데 심사 중이라 insights가 빈 배열이다.
// 목록에서 빼면 "방금 만든 광고가 왜 안 보이지"가 되므로 남기고 상태로 알린다.
test("성과가 아직 없는 광고도 목록에 남기고 미집행 상태로 표시한다", () => {
  const [unit] = buildAdUnits({
    ads: [ad({ effective_status: "PENDING_REVIEW" })],
    adsets: [adset()],
    campaigns: [],
    insights: [],
    currency: "KRW",
  });

  expect(unit.status).toBe("PENDING_REVIEW");
  expect(unit.hasDelivery).toBe(false);
  expect(unit.spend).toBe(0);
  expect(unit.impressions).toBe(0);
  expect(unit.results).toBeNull();
  expect(unit.costPerResult).toBeNull();
  expect(unit.activity).toEqual([]);
});

test("인스타 게시물에 붙지 않은 광고도 버리지 않는다", () => {
  const [unit] = buildAdUnits({
    ads: [ad({ creative: { thumbnail_url: "https://scontent.example/fb.jpg" } })],
    adsets: [adset()],
    campaigns: [],
    insights: [insight()],
    currency: "KRW",
  });

  expect(unit.mediaId).toBeUndefined();
  expect(unit.spend).toBe(3427);
});

test("아는 행동은 한국어 이름을 붙이고 모르는 행동은 원문 키로 남긴다", () => {
  const [unit] = buildAdUnits({
    ads: [ad()],
    adsets: [adset()],
    campaigns: [],
    insights: [
      insight({
        actions: [
          { action_type: "post_reaction", value: "20" },
          { action_type: "onsite_conversion.post_save", value: "16" },
          { action_type: "link_click", value: "85" },
          { action_type: "some_future_action", value: "7" },
        ],
      }),
    ],
    currency: "KRW",
  });

  const byKey = new Map(unit.activity.map((row) => [row.key, row]));
  expect(byKey.get("post_reaction")).toMatchObject({ label: "게시물 반응", value: 20 });
  expect(byKey.get("onsite_conversion.post_save")).toMatchObject({ label: "게시물 저장", value: 16 });
  // 모르는 키를 감추면 Business Suite에는 있는 막대가 여기서만 사라진다.
  expect(byKey.get("some_future_action")).toMatchObject({ label: null, value: 7 });
});

// 모르는 키를 참여로 뭉뚱그리면 참여 단가가 조용히 부풀어 광고가 실제보다 좋아 보인다.
test("참여 합산에는 확신하는 행동만 넣는다", () => {
  const [unit] = buildAdUnits({
    ads: [ad()],
    adsets: [adset()],
    campaigns: [],
    insights: [
      insight({
        actions: [
          { action_type: "post_reaction", value: "20" },
          { action_type: "comment", value: "3" },
          { action_type: "post", value: "12" },
          { action_type: "onsite_conversion.post_save", value: "16" },
          { action_type: "some_future_action", value: "999" },
        ],
      }),
    ],
    currency: "KRW",
  });

  expect(unit.engagements).toBe(51);
});

test("성과는 있는데 행동이 하나도 없으면 참여를 0이 아니라 모름으로 둔다", () => {
  const [unit] = buildAdUnits({
    ads: [ad()],
    adsets: [adset()],
    campaigns: [],
    insights: [insight({ actions: undefined })],
    currency: "KRW",
  });

  expect(unit.engagements).toBeNull();
});

test("동영상 조회 목표는 ThruPlay 수를 결과로 센다", () => {
  const [unit] = buildAdUnits({
    ads: [ad()],
    adsets: [adset({ optimization_goal: "THRUPLAY" })],
    campaigns: [],
    insights: [
      insight({
        video_thruplay_watched_actions: [{ action_type: "video_view", value: "305" }],
        cost_per_action_type: [{ action_type: "video_view", value: "11.23" }],
      }),
    ],
    currency: "KRW",
  });

  expect(unit.results).toEqual({ count: 305, type: "THRUPLAY" });
  expect(unit.costPerResult).toBeCloseTo(11.23);
});

test("링크 클릭 목표는 링크 클릭 수를 결과로 세고 단가는 Meta 집계를 그대로 쓴다", () => {
  const [unit] = buildAdUnits({
    ads: [ad()],
    adsets: [adset({ optimization_goal: "LINK_CLICKS" })],
    campaigns: [],
    insights: [
      insight({
        actions: [{ action_type: "link_click", value: "85" }],
        cost_per_action_type: [{ action_type: "link_click", value: "40.32" }],
      }),
    ],
    currency: "KRW",
  });

  expect(unit.results).toEqual({ count: 85, type: "LINK_CLICKS" });
  expect(unit.costPerResult).toBeCloseTo(40.32);
});

test("단가를 Meta가 주지 않으면 지출을 결과 수로 나눈다", () => {
  const [unit] = buildAdUnits({
    ads: [ad()],
    adsets: [adset({ optimization_goal: "LINK_CLICKS" })],
    campaigns: [],
    insights: [insight({ spend: "3400", actions: [{ action_type: "link_click", value: "85" }] })],
    currency: "KRW",
  });

  expect(unit.costPerResult).toBeCloseTo(40);
});

// 목표를 모르면서 아무 행동이나 결과로 세면 화면이 조용히 틀린 수를 말한다.
test("모르는 목표는 결과를 세지 않고 목표 이름만 남긴다", () => {
  const [unit] = buildAdUnits({
    ads: [ad()],
    adsets: [adset({ optimization_goal: "SOME_NEW_GOAL" })],
    campaigns: [],
    insights: [insight({ actions: [{ action_type: "link_click", value: "85" }] })],
    currency: "KRW",
  });

  expect(unit.goal).toBe("SOME_NEW_GOAL");
  expect(unit.results).toBeNull();
  expect(unit.costPerResult).toBeNull();
});

test("예산은 일일과 총액을 구분하고 광고 세트에 없으면 캠페인에서 가져온다", () => {
  const daily = buildAdUnits({
    ads: [ad()],
    adsets: [adset({ daily_budget: "2000" })],
    campaigns: [],
    insights: [insight()],
    currency: "KRW",
  })[0];
  expect(daily.budget).toEqual({ amount: 2000, kind: "DAILY" });

  // 오늘 실측한 광고는 광고 세트에 예산이 없었다. Advantage 캠페인 예산이라 캠페인에 있다.
  const fromCampaign = buildAdUnits({
    ads: [ad()],
    adsets: [adset()],
    campaigns: [{ id: "120253915876260651", lifetime_budget: "4129" } as GraphCampaign],
    insights: [insight()],
    currency: "KRW",
  })[0];
  expect(fromCampaign.budget).toEqual({ amount: 4129, kind: "LIFETIME" });
});

// Meta는 예산을 계정 통화의 최소 단위로 준다. 원화는 보조 단위가 없어 그대로지만
// 달러는 100으로 나눠야 한다. 이걸 틀리면 화면이 예산을 100배로 말한다.
test("예산 단위를 통화에 맞춰 옮긴다", () => {
  expect(budgetToMajorUnit("2000", "KRW")).toBe(2000);
  expect(budgetToMajorUnit("2000", "USD")).toBe(20);
  expect(budgetToMajorUnit("2000", "JPY")).toBe(2000);
  expect(budgetToMajorUnit(undefined, "KRW")).toBeNull();
});

test("지출이 큰 순으로 정렬한다", () => {
  const units = buildAdUnits({
    ads: [
      ad({ id: "1", adset_id: "s1" }),
      ad({ id: "2", adset_id: "s2" }),
      ad({ id: "3", adset_id: "s3" }),
    ],
    adsets: [adset({ id: "s1" }), adset({ id: "s2" }), adset({ id: "s3" })],
    campaigns: [],
    insights: [
      insight({ ad_id: "1", spend: "100" }),
      insight({ ad_id: "2", spend: "3000" }),
      insight({ ad_id: "3", spend: "500" }),
    ],
    currency: "KRW",
  });

  expect(units.map((unit) => unit.adId)).toEqual(["2", "3", "1"]);
});
