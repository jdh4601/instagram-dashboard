/**
 * Marketing API 응답 → 광고 한 건.
 *
 * `lib/ads/map.ts`가 광고를 게시물 단위로 합치는 것과 축이 다르다. 여기서는 합치기
 * 이전 단계를 남긴다 — 상태, 목표, 예산, 기간은 광고마다 다른 값이라 합산하는 순간
 * 사라지고, 그러면 Business Suite의 광고 목록을 그릴 수 없다.
 *
 * 게시물에 붙지 않은 광고도 버리지 않는다. 페이스북 전용 소재나 아직 크리에이티브가
 * 덜 붙은 광고를 목록에서 빼면, 방금 만든 광고가 왜 안 보이는지 알 길이 없다.
 */
import type { GraphAction, GraphAd, GraphAdInsight } from "@/lib/ads/map";

/** /{act}/adsets 한 건 */
export interface GraphAdSet {
  id: string;
  optimization_goal?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
  effective_status?: string;
}

/** /{act}/campaigns 한 건. Advantage 캠페인은 예산을 여기에 둔다. */
export interface GraphCampaign {
  id: string;
  name?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

/**
 * 광고에 달린 행동 한 줄.
 *
 * 아는 키만 거르지 않는다. Meta의 행동 목록은 계정·목표에 따라 달라서, 고정 목록으로
 * 거르면 Business Suite에는 있는 막대가 여기서만 사라진다. 대신 이름을 붙이지 못한
 * 것은 `label`을 비워 두고, 합산에는 넣지 않는다.
 */
export interface AdActivityItem {
  key: string;
  label: string | null;
  value: number;
}

export interface AdUnit {
  adId: string;
  name: string;
  /** effective_status. 심사 중·집행 중·종료를 가른다. */
  status: string;
  createdAt?: string;
  thumbnailUrl?: string;
  permalink?: string;
  /** 오가닉 게시물과 이을 수 있을 때만 있다. 못 이어도 광고는 목록에 남는다. */
  mediaId?: string;

  spend: number;
  /** 노출. Business Suite가 Views라고 부르는 값이다. */
  impressions: number;
  /** 도달. Business Suite가 Viewers라고 부르는 값이다. */
  reach: number;
  clicks: number;

  /** optimization_goal 원문. 결과가 무엇을 세는지 이 값이 정한다. */
  goal: string | null;
  /** 목표 달성 수와 그 목표. 목표를 모르면 세지 않는다. */
  results: { count: number; type: string } | null;
  costPerResult: number | null;

  budget: { amount: number; kind: "DAILY" | "LIFETIME" } | null;
  startTime?: string;
  endTime?: string;

  /** 받은 행동을 그대로 나열한 것. 표시 전용이며 합산에 쓰지 않는다. */
  activity: AdActivityItem[];
  /** 좋아요·댓글·공유·저장의 합. 행동을 하나도 못 받으면 0이 아니라 null이다. */
  engagements: number | null;
  /** 성과가 한 줄이라도 왔는지. 심사 중인 광고는 false다. */
  hasDelivery: boolean;
}

/** 화면에 한국어로 적을 수 있는 행동. 없는 키는 원문 그대로 보여 준다. */
const ACTIVITY_LABELS: Record<string, string> = {
  video_view: "3초 동영상 재생",
  thruplay: "ThruPlay",
  link_click: "링크 클릭",
  post_reaction: "게시물 반응",
  comment: "댓글",
  post: "게시물 공유",
  "onsite_conversion.post_save": "게시물 저장",
  post_engagement: "게시물 참여",
  page_engagement: "페이지 참여",
  landing_page_view: "랜딩 페이지 조회",
  "onsite_conversion.ig_profile_visit": "인스타그램 프로필 방문",
  "onsite_conversion.follow": "인스타그램 팔로우",
  like: "페이지 좋아요",
  lead: "잠재 고객",
};

/**
 * 참여로 셀 행동.
 *
 * 확신하는 것만 넣는다. 모르는 키까지 참여로 뭉뚱그리면 참여 단가가 조용히 부풀어
 * 광고가 실제보다 잘 먹힌 것처럼 보인다.
 */
const ENGAGEMENT_ACTIONS = new Set([
  "post_reaction",
  "comment",
  "post",
  "onsite_conversion.post_save",
]);

/**
 * 목표 → 결과로 셀 행동 키.
 *
 * 목표를 모르면 결과를 세지 않는다. 아무 행동이나 결과 자리에 놓으면 화면이 조용히
 * 틀린 수를 말하고, 그 수로 광고를 죽이거나 살리게 된다.
 */
const RESULT_ACTION_BY_GOAL: Record<string, string> = {
  LINK_CLICKS: "link_click",
  LANDING_PAGE_VIEWS: "landing_page_view",
  POST_ENGAGEMENT: "post_engagement",
  PAGE_LIKES: "like",
  LEAD_GENERATION: "lead",
  PROFILE_VISIT: "onsite_conversion.ig_profile_visit",
  IG_PROFILE_VISIT: "onsite_conversion.ig_profile_visit",
};

/** ThruPlay는 actions가 아니라 전용 필드로 와서 따로 다룬다. */
const THRUPLAY_GOAL = "THRUPLAY";

/**
 * 보조 단위가 없는 통화.
 *
 * Meta는 예산을 계정 통화의 최소 단위로 준다. 달러는 100으로 나눠야 하지만 원화는
 * 그대로다. 이걸 뭉뚱그리면 화면이 예산을 100배나 100분의 1로 말한다.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "KRW",
  "JPY",
  "VND",
  "CLP",
  "ISK",
  "TWD",
  "HUF",
  "COP",
  "IDR",
  "PYG",
  "UGX",
  "RWF",
  "XAF",
  "XOF",
  "XPF",
  "BIF",
  "DJF",
  "GNF",
  "KMF",
  "MGA",
  "VUV",
]);

function num(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 최소 단위로 온 예산을 화면에 쓰는 단위로 옮긴다. 없는 값은 null이다. */
export function budgetToMajorUnit(raw: string | undefined, currency: string): number | null {
  if (raw === undefined || raw === "") return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return null;
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? parsed : parsed / 100;
}

function findAction(rows: GraphAction[] | undefined, key: string): number | null {
  const hit = rows?.find((row) => row.action_type === key);
  return hit ? num(hit.value) : null;
}

function budgetOf(
  adset: GraphAdSet | undefined,
  campaign: GraphCampaign | undefined,
  currency: string,
): AdUnit["budget"] {
  // 광고 세트가 먼저다. Advantage 캠페인 예산을 쓰면 광고 세트에는 값이 없어
  // 캠페인으로 물러난다 — 실측한 광고가 정확히 이 모양이었다.
  const sources: Array<{ daily?: string; lifetime?: string }> = [
    { daily: adset?.daily_budget, lifetime: adset?.lifetime_budget },
    { daily: campaign?.daily_budget, lifetime: campaign?.lifetime_budget },
  ];
  for (const source of sources) {
    const daily = budgetToMajorUnit(source.daily, currency);
    if (daily !== null && daily > 0) return { amount: daily, kind: "DAILY" };
    const lifetime = budgetToMajorUnit(source.lifetime, currency);
    if (lifetime !== null && lifetime > 0) return { amount: lifetime, kind: "LIFETIME" };
  }
  return null;
}

/** 목표에 해당하는 결과 수와 단가. 목표를 모르면 둘 다 없다. */
function resultsOf(
  goal: string | null,
  insight: GraphAdInsight | undefined,
  spend: number,
): { results: AdUnit["results"]; costPerResult: number | null } {
  const none = { results: null, costPerResult: null };
  if (!goal || !insight) return none;

  const actionKey = goal === THRUPLAY_GOAL ? "video_view" : RESULT_ACTION_BY_GOAL[goal];
  if (!actionKey) return none;

  const count =
    goal === THRUPLAY_GOAL
      ? findAction(insight.video_thruplay_watched_actions, actionKey)
      : findAction(insight.actions, actionKey);
  if (count === null) return none;

  // 단가는 Meta 집계를 먼저 쓴다. 우리가 다시 나누면 어트리뷰션 창이 달라 광고
  // 관리자와 어긋난 수가 나온다.
  const reported = findAction(insight.cost_per_action_type, actionKey);
  const costPerResult = reported !== null ? reported : count > 0 ? spend / count : null;

  return { results: { count, type: goal }, costPerResult };
}

/** 받은 행동을 화면용 목록으로 옮긴다. 3초 재생은 전용 필드라 함께 얹는다. */
function activityOf(insight: GraphAdInsight | undefined): AdActivityItem[] {
  if (!insight) return [];
  const rows: AdActivityItem[] = [];
  const seen = new Set<string>();

  const push = (key: string | undefined, value: string | undefined) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push({ key, label: ACTIVITY_LABELS[key] ?? null, value: num(value) });
  };

  for (const action of insight.video_play_actions ?? []) {
    // 전용 필드의 video_view는 3초 재생이다. actions에도 같은 키가 있을 수 있어 먼저 넣는다.
    push(action.action_type, action.value);
  }
  for (const action of insight.actions ?? []) {
    push(action.action_type, action.value);
  }

  return rows.sort((a, b) => b.value - a.value);
}

function engagementsOf(insight: GraphAdInsight | undefined): number | null {
  // 행동을 한 줄도 못 받은 상태를 0으로 채우면 "모른다"가 "반응이 없었다"로 읽힌다.
  if (!insight?.actions) return null;
  let total = 0;
  for (const action of insight.actions) {
    if (action.action_type && ENGAGEMENT_ACTIONS.has(action.action_type)) total += num(action.value);
  }
  return total;
}

export interface AdUnitSources {
  ads: GraphAd[];
  adsets: GraphAdSet[];
  campaigns: GraphCampaign[];
  insights: GraphAdInsight[];
  /** 광고 계정 통화. 예산 단위를 옮기는 데 쓴다. */
  currency: string;
}

/** 광고·광고 세트·캠페인·성과를 광고 한 건으로 맞물린다. 지출이 큰 순으로 준다. */
export function buildAdUnits(sources: AdUnitSources): AdUnit[] {
  const adsetById = new Map(sources.adsets.map((row) => [row.id, row]));
  const campaignById = new Map(sources.campaigns.map((row) => [row.id, row]));
  const insightByAdId = new Map<string, GraphAdInsight>();
  for (const row of sources.insights) {
    if (row.ad_id) insightByAdId.set(row.ad_id, row);
  }

  const units = sources.ads.map((ad): AdUnit => {
    const adset = ad.adset_id ? adsetById.get(ad.adset_id) : undefined;
    const campaign = ad.campaign_id ? campaignById.get(ad.campaign_id) : undefined;
    const insight = insightByAdId.get(ad.id);
    const spend = num(insight?.spend);
    const goal = adset?.optimization_goal ?? null;
    const { results, costPerResult } = resultsOf(goal, insight, spend);

    return {
      adId: ad.id,
      name: ad.name ?? ad.id,
      status: ad.effective_status ?? "UNKNOWN",
      createdAt: ad.created_time,
      thumbnailUrl: ad.creative?.thumbnail_url,
      permalink: ad.creative?.instagram_permalink_url,
      mediaId: ad.creative?.effective_instagram_media_id,

      spend,
      impressions: num(insight?.impressions),
      reach: num(insight?.reach),
      clicks: num(insight?.clicks),

      goal,
      results,
      costPerResult,

      budget: budgetOf(adset, campaign, sources.currency),
      startTime: adset?.start_time,
      endTime: adset?.end_time,

      activity: activityOf(insight),
      engagements: engagementsOf(insight),
      hasDelivery: insight !== undefined,
    };
  });

  return units.sort((a, b) => b.spend - a.spend);
}
