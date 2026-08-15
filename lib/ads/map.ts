/**
 * Marketing API 응답 → 게시물별 광고 성과.
 *
 * 조인 키는 creative.effective_instagram_media_id다. 이 값이 이 앱이 동기화하는
 * 게시물 id와 같은 공간에 있어서, 광고와 오가닉 지표를 같은 줄에 놓을 수 있다.
 * 비어 있는 광고(페이스북 전용 소재, 새로 만든 크리에이티브)는 조인할 수 없어 버린다.
 */

/** /{act}/ads 한 건 */
export interface GraphAd {
  id: string;
  name?: string;
  effective_status?: string;
  creative?: {
    effective_instagram_media_id?: string;
    instagram_permalink_url?: string;
  };
}

/** /{act}/insights?level=ad 한 줄 */
export interface GraphAdInsight {
  ad_id?: string;
  spend?: string;
  reach?: string;
  impressions?: string;
  frequency?: string;
  cpm?: string;
  clicks?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
}

/**
 * 광고 행동 유형 → 우리가 쓰는 이름.
 *
 * Meta는 행동을 문자열 키로 돌려주고 목록이 계정·목표에 따라 다르다. 확신하는
 * 것만 옮기고 나머지는 버린다 — 모르는 키를 참여로 뭉뚱그리면 참여 단가가 조용히
 * 부풀어 광고 효율이 실제보다 좋아 보인다.
 */
const ACTION_ALIASES: Record<string, keyof AdActions> = {
  post_reaction: "likes",
  comment: "comments",
  post: "shares",
  "onsite_conversion.post_save": "saves",
  link_click: "linkClicks",
  post_engagement: "totalEngagement",
};

export interface AdActions {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  linkClicks: number;
  /** Meta가 직접 집계한 총 참여. 개별 항목의 합과 다를 수 있어 따로 둔다. */
  totalEngagement: number;
}

export interface AdPerformance {
  /** 조인 키 — 오가닉 게시물 id */
  mediaId: string;
  /** 이 게시물에 붙은 광고 수. 한 게시물을 여러 번 태울 수 있다. */
  adCount: number;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  actions: AdActions;
  permalink?: string;
}

function num(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyActions(): AdActions {
  return { likes: 0, comments: 0, shares: 0, saves: 0, linkClicks: 0, totalEngagement: 0 };
}

/**
 * 광고 목록과 성과를 ad_id로 맞물린 뒤 게시물 단위로 합산한다.
 *
 * 성과가 없는 광고(집행 전, 노출 0)는 지출 0으로 남긴다 — 목록에서 빼면 "태웠는데
 * 아직 안 도는 광고"가 화면에서 통째로 사라져 왜 안 보이는지 알 수 없다.
 */
export function buildAdPerformance(
  ads: GraphAd[],
  insights: GraphAdInsight[],
): AdPerformance[] {
  const byAdId = new Map<string, GraphAdInsight>();
  for (const row of insights) {
    if (row.ad_id) byAdId.set(row.ad_id, row);
  }

  const byMedia = new Map<string, AdPerformance>();
  for (const ad of ads) {
    const mediaId = ad.creative?.effective_instagram_media_id;
    if (!mediaId) continue;

    const current = byMedia.get(mediaId) ?? {
      mediaId,
      adCount: 0,
      spend: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
      actions: emptyActions(),
      permalink: ad.creative?.instagram_permalink_url,
    };
    current.adCount += 1;

    const insight = byAdId.get(ad.id);
    if (insight) {
      current.spend += num(insight.spend);
      // 도달은 광고끼리도 중복되지만 Marketing API가 합집합을 주지 않는다.
      // 합으로 두면 실제보다 크다 — CPM 분모로 쓰지 않고 노출을 쓰는 이유다.
      current.reach += num(insight.reach);
      current.impressions += num(insight.impressions);
      current.clicks += num(insight.clicks);
      for (const action of insight.actions ?? []) {
        const key = action.action_type ? ACTION_ALIASES[action.action_type] : undefined;
        if (key) current.actions[key] += num(action.value);
      }
    }
    byMedia.set(mediaId, current);
  }

  return [...byMedia.values()].sort((a, b) => b.spend - a.spend);
}
