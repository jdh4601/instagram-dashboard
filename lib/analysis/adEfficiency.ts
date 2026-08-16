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

  /**
   * 목표 행동 수와 유형. Ad Center 기록에만 있다.
   * 유형이 다르면 서로 다른 자라서 한 표에 섞어 순위를 매기면 안 된다.
   */
  resultCount: number | null;
  resultType: string | null;
  /** 결과 한 건당 비용. 결과가 0이거나 유형을 모르면 null. */
  costPerResult: number | null;
  /**
   * 광고 도달 100명당 결과 수(%). 돈을 빼고 본 반응 효율이라, 단가가 비싼 소재가
   * 실제로도 안 먹힌 건지 그냥 비싸게 산 건지 가른다.
   */
  resultRate: number | null;

  organicReach: number;
  organicEngagements: number;
  organicEngagementRate: number | null;

  /**
   * 오가닉 대비 광고의 반응률 배수. 1을 밑돌면 산 도달이 덜 반응했다는 뜻이다.
   * 어느 한쪽 반응률을 못 구하면 null.
   */
  efficiencyRatio: number | null;
}

export type AdEfficiencySort =
  | "spend"
  | "adReach"
  | "cpm"
  | "costPerResult"
  | "resultRate"
  | "costPerEngagement"
  | "efficiencyRatio";

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
  // 참여를 모르는 기록(Ad Center)은 0으로 채우지 않는다 — "모른다"가 "반응이
  // 없었다"로 읽히면 광고를 잘못 죽이게 된다.
  const adEngagements = ad.actions
    ? ad.actions.likes + ad.actions.comments + ad.actions.shares + ad.actions.saves
    : null;
  const organicEngagements = organicEngagementsOf(reel);
  const adEngagementRate =
    adEngagements === null ? null : ratePerHundred(adEngagements, ad.reach);
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
    adEngagements: adEngagements ?? 0,
    costPerEngagement: adEngagements === null ? null : divide(ad.spend, adEngagements),
    adEngagementRate,

    resultCount: ad.results?.count ?? null,
    resultType: ad.results?.type ?? null,
    costPerResult: ad.results ? divide(ad.spend, ad.results.count) : null,
    resultRate: ad.results ? ratePerHundred(ad.results.count, ad.reach) : null,

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
  if (sort === "costPerResult") return row.costPerResult;
  if (sort === "resultRate") return row.resultRate;
  if (sort === "adReach") return row.adReach;
  return row.costPerEngagement;
}

// 비용은 낮을수록 좋고, 지출·도달·반응률은 높을수록 위에 온다.
const ASCENDING: AdEfficiencySort[] = ["costPerEngagement", "cpm", "costPerResult"];

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
  /** 결과 합계와 단가. 유형이 같은 행끼리 묶은 뒤에만 의미가 있다. */
  resultCount: number;
  costPerResult: number | null;
  /** 태운 게시물 수 */
  postCount: number;
}

/** 표 위에 한 줄로 얹는 합계. 평균이 아니라 합에서 다시 나눈다 — 비율의 평균은 틀린다. */
export function sumAdEfficiency(rows: AdEfficiencyRow[]): AdEfficiencyTotals {
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const adReach = rows.reduce((sum, row) => sum + row.adReach, 0);
  const adImpressions = rows.reduce((sum, row) => sum + row.adImpressions, 0);
  const adEngagements = rows.reduce((sum, row) => sum + row.adEngagements, 0);
  // 행이 "결과" 칸에 참여 수를 대신 보여 주는 것과 같은 규칙으로 센다. 여기서만
  // ?? 0을 쓰면 참여로 재는 광고의 합계가 통째로 0이 되어 표 안에서 어긋난다.
  const resultCount = rows.reduce((sum, row) => sum + (row.resultCount ?? row.adEngagements), 0);
  return {
    spend,
    adReach,
    adImpressions,
    adEngagements,
    cpm: divide(spend * 1000, adImpressions),
    costPerEngagement: divide(spend, adEngagements),
    resultCount,
    costPerResult: divide(spend, resultCount),
    postCount: rows.length,
  };
}

export interface AdEfficiencyFilter {
  /** 릴스만·캐러셀만. 비우면 둘 다. */
  mediaType?: MediaKind;
  /** 결과 유형. 비우면 전부. */
  resultType?: string;
}

/** 표를 나누는 대신 거른다 — 쪼갠 표 네 개보다 한 표에 필터가 읽기 쉽다. */
export function filterAdEfficiency(
  rows: AdEfficiencyRow[],
  filter: AdEfficiencyFilter,
): AdEfficiencyRow[] {
  return rows.filter((row) => {
    if (filter.mediaType && row.mediaType !== filter.mediaType) return false;
    if (filter.resultType && row.resultType !== filter.resultType) return false;
    return true;
  });
}

/**
 * 지금 보고 있는 목록에 결과 유형이 두 가지 이상 섞여 있는가.
 *
 * 프로필 방문 ₩54와 링크 클릭 ₩124를 한 줄에 세우면 "프로필 방문이 2배 효율적"으로
 * 읽히지만, 사실은 더 싼 행동을 산 것뿐이다. 단가로 정렬할 때 이 사실을 밝혀야 한다.
 */
export function hasMixedResultTypes(rows: AdEfficiencyRow[]): boolean {
  const types = new Set(rows.map((row) => row.resultType));
  return types.size > 1;
}
