/**
 * 광고 한 건의 효율 지표.
 *
 * `lib/analysis/adEfficiency.ts`가 게시물 단위로 합친 뒤 오가닉과 견주는 것과 축이
 * 다르다. 여기서는 합치기 이전의 광고 한 건을 그대로 나눈다 — 같은 게시물을 여러 번
 * 태웠을 때 어느 회차가 비쌌는지는 합산한 줄에서 사라진다.
 *
 * Meta도 insights에 `cpm`과 `frequency`를 함께 준다. 그래도 직접 나누는 이유는, 이
 * 두 값이 같은 응답 줄 안의 지출·노출·도달만으로 정해져 우리가 구해도 값이 같기
 * 때문이다. 결과 단가에서 Meta 집계를 먼저 쓰는 것과는 사정이 다르다 — 그쪽은 행동의
 * 어트리뷰션 창이 우리 계산과 달라서 광고 관리자와 수가 어긋난다.
 */

export interface AdUnitMetricsInput {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  /** 좋아요·댓글·공유·저장의 합. 행동을 하나도 못 받으면 0이 아니라 null이다. */
  engagements: number | null;
}

export interface AdUnitMetrics {
  /** 노출 1,000회당 비용 */
  cpm: number | null;
  /** 클릭 한 번당 비용 */
  cpc: number | null;
  /** 노출 100회당 클릭 수(%) */
  ctr: number | null;
  /** 한 사람이 이 광고를 본 평균 횟수 */
  frequency: number | null;
  /** 도달 100명당 참여 수(%) */
  engagementRate: number | null;
  /** 참여 한 건당 비용 */
  costPerEngagement: number | null;
}

/** 분모가 0이면 나눌 수 없다. 0으로 채우면 "계산할 수 없다"가 "0이었다"로 읽힌다. */
function divide(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function ratePerHundred(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function adUnitMetrics(unit: AdUnitMetricsInput): AdUnitMetrics {
  const { spend, impressions, reach, clicks, engagements } = unit;

  return {
    cpm: divide(spend * 1000, impressions),
    cpc: divide(spend, clicks),
    ctr: ratePerHundred(clicks, impressions),
    frequency: divide(impressions, reach),
    // 참여를 못 받은 것과 참여가 0인 것을 가른다. 앞은 모르는 상태라 비워 두고,
    // 뒤는 아는 사실이라 0%로 적는다.
    engagementRate: engagements === null ? null : ratePerHundred(engagements, reach),
    costPerEngagement: engagements === null ? null : divide(spend, engagements),
  };
}
