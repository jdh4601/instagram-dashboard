import { ACCOUNT_FUNNEL_BENCHMARKS, type AccountFunnelMetricKey } from "@/config/benchmarks";
import { classifyBand, type Band } from "@/lib/analysis/diagnosis";
import type { AccountSnapshot } from "@/lib/schemas";

export const ACCOUNT_FUNNEL_WINDOW_DAYS = 7;

/**
 * 직전 스냅샷 대비 전환율 증감(퍼센트포인트).
 *
 * 주의: 각 스냅샷은 7일 롤링 값이라 하루 차이 두 스냅샷은 6일치를 공유한다.
 * 따라서 이 증감은 "어제 하루의 성과"가 아니라 창에 새로 들어온 하루와 빠져나간
 * 하루의 차이이며, 실제 변화보다 작게 나타난다.
 */
export interface AccountFunnelDeltas {
  viewRate: number | null;
  followRate: number | null;
  linkClickRate: number | null;
}

export interface AccountFunnel {
  /** 스냅샷 날짜 — 화면에 "언제 기준"인지 밝힌다. */
  date: string;
  /** 계정 도달(중복 제거). */
  reach: number;
  /** 프로필 방문 횟수. 미측정이면 null. */
  profileViews: number | null;
  /** 팔로우한 계정 수. 미측정이면 null. */
  follows: number | null;
  /** 팔로우를 취소한 계정 수. 미측정이면 null. */
  unfollows: number | null;
  /** 팔로우 − 언팔로우. 둘 중 하나라도 없으면 null. */
  netFollows: number | null;
  /** 바이오 링크 클릭 수. 미측정이면 null. */
  websiteClicks: number | null;
  /** 방문 ÷ 도달, %. */
  viewRate: number | null;
  /** 팔로우 ÷ 방문, %. */
  followRate: number | null;
  /** 링크 클릭 ÷ 방문, %. 팔로우와 같은 분모다 — 둘은 순차가 아니라 병렬 결과다. */
  linkClickRate: number | null;
  /** 증감을 비교한 스냅샷 날짜. 비교 대상이 없으면 null. */
  previousDate: string | null;
  /** 직전 스냅샷 대비 전환율 증감(%p). */
  deltas: AccountFunnelDeltas;
}

function rate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function optional(value: number | undefined): number | null {
  return typeof value === "number" ? value : null;
}

/** 한 스냅샷의 세 전환율. 증감 계산이 현재/직전에 같은 식을 쓰도록 한곳에 모은다. */
function ratesOf(snapshot: AccountSnapshot): AccountFunnelDeltas {
  const profileViews = optional(snapshot.profileViewsLast7d);
  return {
    viewRate: rate(profileViews, snapshot.reachLast7d),
    followRate: rate(optional(snapshot.followsLast7d), profileViews),
    linkClickRate: rate(optional(snapshot.websiteClicksLast7d), profileViews),
  };
}

function diff(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

/**
 * 계정 레벨 도달 → 프로필 방문 → 팔로우 퍼널.
 *
 * 게시물별 profile_visits/follows를 합산하지 않는다. Graph가 릴스에는 두 지표를
 * 아예 주지 않고("does not support ... for this media product type"), 캐러셀에서
 * 잡히는 팔로우도 계정 실제 증가분의 일부만 설명한다. 게시물 귀속이 불가능한
 * 유입(검색·추천·프로필 직접 방문)이 대부분이라, 성장을 보려면 계정 레벨이어야 한다.
 *
 * 대신 미디어 필터와 무관한 계정 전체 수치이므로 화면에 그 기준을 명시해야 한다.
 *
 * 누락 지표를 0으로 채우지 않는다. 채우면 "전환이 없다"와 "측정이 안 된다"가 섞인다.
 */
export function buildAccountFunnel(snapshots: AccountSnapshot[]): AccountFunnel | null {
  if (snapshots.length === 0) return null;

  const latest = snapshots.reduce((best, current) => (current.date > best.date ? current : best));

  const profileViews = optional(latest.profileViewsLast7d);
  const follows = optional(latest.followsLast7d);
  const unfollows = optional(latest.unfollowsLast7d);
  const websiteClicks = optional(latest.websiteClicksLast7d);

  // 도달만 남으면 단계가 하나뿐이라 퍼널로서 읽을 게 없다.
  if (profileViews === null && follows === null && unfollows === null && websiteClicks === null) {
    return null;
  }

  const earlier = snapshots.filter((candidate) => candidate.date < latest.date);
  const previous =
    earlier.length === 0
      ? null
      : earlier.reduce((best, current) => (current.date > best.date ? current : best));

  const current = ratesOf(latest);
  const before = previous === null ? null : ratesOf(previous);

  return {
    date: latest.date,
    reach: latest.reachLast7d,
    profileViews,
    follows,
    unfollows,
    netFollows: follows === null || unfollows === null ? null : follows - unfollows,
    websiteClicks,
    ...current,
    previousDate: previous === null ? null : previous.date,
    deltas: {
      viewRate: diff(current.viewRate, before?.viewRate ?? null),
      followRate: diff(current.followRate, before?.followRate ?? null),
      linkClickRate: diff(current.linkClickRate, before?.linkClickRate ?? null),
    },
  };
}

export type AccountFunnelVerdicts = Record<AccountFunnelMetricKey, Band | null>;

/**
 * 계정 퍼널 전환율 세 개를 일반적인 업계 벤치마크 추정치(ACCOUNT_FUNNEL_BENCHMARKS)로
 * 판정한다. 게시물 진단(diagnose)과 같은 classifyBand를 쓰되, 표본이 계정 전체
 * 7일 도달이라 항상 충분히 커서 MIN_REACH_FOR_VERDICT 같은 최소 표본 검사는 두지 않는다.
 */
export function accountFunnelVerdicts(funnel: AccountFunnel): AccountFunnelVerdicts {
  const rates: Record<AccountFunnelMetricKey, number | null> = {
    viewRate: funnel.viewRate,
    followRate: funnel.followRate,
    linkClickRate: funnel.linkClickRate,
  };

  return Object.fromEntries(
    (Object.keys(rates) as AccountFunnelMetricKey[]).map((key) => {
      const value = rates[key];
      return [key, value === null ? null : classifyBand(value, ACCOUNT_FUNNEL_BENCHMARKS[key])];
    }),
  ) as AccountFunnelVerdicts;
}
