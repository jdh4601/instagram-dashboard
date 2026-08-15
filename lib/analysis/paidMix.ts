import type { AccountSnapshot } from "@/lib/schemas";

/** 한 지표를 광고분과 오가닉분으로 가른 것. */
export interface PaidSplit {
  /** 광고(AD 면)로 산 몫 */
  paid: number;
  /** 광고를 뺀 나머지 면(릴스·캐러셀·스토리·피드)의 합 */
  organic: number;
  /**
   * breakdown 합. 도달은 면 사이의 중복을 제거해 Graph의 총량(reachLast7d)보다 크다.
   * 비중을 잴 때는 반드시 이 값을 분모로 써야 두 막대가 100%로 맞는다.
   */
  total: number;
  /** 광고가 차지하는 비중(%) */
  paidShare: number;
}

export interface PaidMix {
  /** 도달. 광고/오가닉 분리가 성립하는 최소 조건이다. */
  reach: PaidSplit;
  views?: PaidSplit;
  interactions?: PaidSplit;
  /** 값을 채택한 스냅샷 날짜 */
  date: string;
  /** 이 기간에 광고 집행이 한 건이라도 있었는지. 없으면 카드가 그렇게 말한다. */
  hasPaid: boolean;
}

function split(paid: number | undefined, organic: number | undefined): PaidSplit | undefined {
  if (paid === undefined || organic === undefined) return undefined;
  const total = paid + organic;
  if (total <= 0) return undefined;
  return { paid, organic, total, paidShare: (paid / total) * 100 };
}

/**
 * 광고/오가닉 구성. media_product_type breakdown은 계정 레벨만 지원하고 수집을 시작한
 * 시점 이후 스냅샷에만 있으므로, 도달 분리가 성립하는 가장 최근 스냅샷을 쓴다.
 *
 * 값이 없는 스냅샷은 "광고 0"이 아니라 "모름"이라서 0으로 메우지 않고 건너뛴다.
 */
export function buildPaidMix(snapshots: AccountSnapshot[]): PaidMix | null {
  const usable = snapshots
    .filter((s) => split(s.paidReachLast7d, s.organicReachLast7d) !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = usable.at(-1);
  if (!latest) return null;

  const reach = split(latest.paidReachLast7d, latest.organicReachLast7d)!;
  const views = split(latest.paidViewsLast7d, latest.organicViewsLast7d);
  const interactions = split(latest.paidInteractionsLast7d, latest.organicInteractionsLast7d);

  return {
    reach,
    views,
    interactions,
    date: latest.date,
    hasPaid: reach.paid > 0 || (views?.paid ?? 0) > 0 || (interactions?.paid ?? 0) > 0,
  };
}
