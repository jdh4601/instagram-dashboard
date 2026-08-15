import type { AdPerformance } from "@/lib/ads/map";
import type { MediaKind, Reel } from "@/lib/schemas";

/**
 * 게시물 한 건의 광고 효율. 광고 성과(Marketing API)와 오가닉 지표(Instagram
 * Insights)를 같은 줄에 놓은 것이다.
 *
 * 두 출처의 도달은 서로 겹치지 않는다 — 게시물 레벨 reach는 오가닉만 세고, 광고
 * 도달은 광고 계정이 따로 센다. 그래서 둘을 나란히 비교할 수 있다.
 */
export interface AdEfficiencyRow {
  mediaId: string;
  mediaType: MediaKind;
  postedAt: string;
  caption?: string;
  thumbnailUrl?: string;
  permalink?: string;

  /** 이 게시물에 붙은 광고 수 */
  adCount: number;
  spend: number;
  adReach: number;
  adImpressions: number;
  /** 노출 1,000회당 비용. 도달이 아니라 노출이 분모다 — 광고끼리 합산한 도달은 중복이 섞인다. */
  cpm: number | null;
  /** 도달 한 명당 비용 */
  costPerReach: number | null;
  /** 좋아요·댓글·공유·저장의 합 */
  adEngagements: number;
  /** 참여 한 건당 비용. 참여가 0이면 나눌 수 없어 null이다. */
  costPerEngagement: number | null;
  /** 광고 도달 100명당 참여 수(%) */
  adEngagementRate: number | null;

  organicReach: number;
  organicEngagements: number;
  organicEngagementRate: number | null;

  /**
   * 오가닉 대비 광고의 반응률 배수. 1을 밑돌면 산 도달이 덜 반응했다는 뜻이다.
   * 어느 한쪽 반응률을 못 구하면 null.
   */
  efficiencyRatio: number | null;
}

export type AdEfficiencySort = "spend" | "costPerEngagement" | "cpm" | "efficiencyRatio";

function ratePerHundred(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function divide(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/** 오가닉 참여. 게시물 레벨 지표는 광고 상호작용을 세지 않아 그대로 오가닉분이다. */
export function organicEngagementsOf(reel: Reel): number {
  return reel.likes + reel.comments + reel.saves + reel.shares;
}

function toRow(ad: AdPerformance, reel: Reel): AdEfficiencyRow {
  const adEngagements =
    ad.actions.likes + ad.actions.comments + ad.actions.shares + ad.actions.saves;
  const organicEngagements = organicEngagementsOf(reel);
  const adEngagementRate = ratePerHundred(adEngagements, ad.reach);
  const organicEngagementRate = ratePerHundred(organicEngagements, reel.reach);

  return {
    mediaId: ad.mediaId,
    mediaType: reel.mediaType ?? "REELS",
    postedAt: reel.postedAt,
    caption: reel.caption,
    thumbnailUrl: reel.thumbnailUrl,
    permalink: ad.permalink ?? reel.permalink,

    adCount: ad.adCount,
    spend: ad.spend,
    adReach: ad.reach,
    adImpressions: ad.impressions,
    cpm: divide(ad.spend * 1000, ad.impressions),
    costPerReach: divide(ad.spend, ad.reach),
    adEngagements,
    costPerEngagement: divide(ad.spend, adEngagements),
    adEngagementRate,

    organicReach: reel.reach,
    organicEngagements,
    organicEngagementRate,

    efficiencyRatio:
      adEngagementRate === null || organicEngagementRate === null || organicEngagementRate === 0
        ? null
        : adEngagementRate / organicEngagementRate,
  };
}

/** 정렬 키의 값. null(계산 불가)은 언제나 뒤로 민다. */
function sortValue(row: AdEfficiencyRow, sort: AdEfficiencySort): number | null {
  if (sort === "spend") return row.spend;
  if (sort === "cpm") return row.cpm;
  if (sort === "efficiencyRatio") return row.efficiencyRatio;
  return row.costPerEngagement;
}

// 비용은 낮을수록 좋고, 지출·효율 배수는 높을수록 위에 온다.
const ASCENDING: AdEfficiencySort[] = ["costPerEngagement", "cpm"];

/**
 * 광고를 태운 게시물만 골라 효율 표를 만든다.
 *
 * 저장된 게시물에 없는 광고(동기화 전 게시물, 삭제된 게시물)는 버린다 — 오가닉
 * 지표가 없으면 비교할 상대가 없어 표의 절반이 빈칸으로 남는다.
 */
export function buildAdEfficiency(
  ads: AdPerformance[],
  reels: Reel[],
  sort: AdEfficiencySort = "spend",
): AdEfficiencyRow[] {
  const byId = new Map(reels.map((reel) => [reel.id, reel]));
  const rows: AdEfficiencyRow[] = [];
  for (const ad of ads) {
    const reel = byId.get(ad.mediaId);
    if (reel) rows.push(toRow(ad, reel));
  }

  const ascending = ASCENDING.includes(sort);
  return rows.sort((a, b) => {
    const left = sortValue(a, sort);
    const right = sortValue(b, sort);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return ascending ? left - right : right - left;
  });
}

export interface AdEfficiencyTotals {
  spend: number;
  adReach: number;
  adImpressions: number;
  adEngagements: number;
  cpm: number | null;
  costPerEngagement: number | null;
  /** 태운 게시물 수 */
  postCount: number;
}

/** 표 위에 한 줄로 얹는 합계. 평균이 아니라 합에서 다시 나눈다 — 비율의 평균은 틀린다. */
export function sumAdEfficiency(rows: AdEfficiencyRow[]): AdEfficiencyTotals {
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const adReach = rows.reduce((sum, row) => sum + row.adReach, 0);
  const adImpressions = rows.reduce((sum, row) => sum + row.adImpressions, 0);
  const adEngagements = rows.reduce((sum, row) => sum + row.adEngagements, 0);
  return {
    spend,
    adReach,
    adImpressions,
    adEngagements,
    cpm: divide(spend * 1000, adImpressions),
    costPerEngagement: divide(spend, adEngagements),
    postCount: rows.length,
  };
}
