import { ACCOUNT_FUNNEL_BENCHMARKS, type AccountFunnelMetricKey } from "@/config/benchmarks";
import { classifyBand, type Band } from "@/lib/analysis/diagnosis";
import type { AccountSnapshot, Application } from "@/lib/schemas";

export const ACCOUNT_FUNNEL_WINDOW_DAYS = 7;

/**
 * 직전 스냅샷 대비 전환율 증감(퍼센트포인트).
 *
 * 주의: 각 스냅샷은 7일 롤링 값이라 하루 차이 두 스냅샷은 6일치를 공유한다.
 * 따라서 이 증감은 "어제 하루의 성과"가 아니라 창에 새로 들어온 하루와 빠져나간
 * 하루의 차이이며, 실제 변화보다 작게 나타난다.
 */
interface AccountFunnelDeltas {
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
  /** 창 안의 총 신청 수. 신청 폼 미연동이면 null. */
  applications: number | null;
  /** 그중 바이오 링크에서 온 신청(medium=bio). applyRate의 분자다. */
  bioApplications: number | null;
  /**
   * 바이오 신청 ÷ 바이오 링크 클릭, %.
   *
   * Graph가 주지 않는 마지막 구간이라 이 대시보드에서 유일하게 두 출처를 잇는 값이다.
   * 분자를 바이오로 한정하는 이유: websiteClicks는 프로필 바이오 링크 클릭만 세고
   * 스토리 링크 스티커 클릭은 포함하지 않는다. 스토리·광고 신청까지 분자에 넣으면
   * 분모에 없는 유입이 섞여 전환율이 실제보다 높게 나온다.
   *
   * UTM이 붙기 전 신청은 medium이 없어 분자에서 빠진다. 전환 초기에는 과소집계다.
   */
  applyRate: number | null;
  /** 매체별 신청 수. UTM이 없는 신청은 unknown으로 모은다. */
  applicationsByMedium: Record<string, number>;
}

/** 창의 시작일(포함). endDate 당일을 포함해 days일이 되도록 뒤로 센다. */
function windowStart(endDate: string, days: number): string {
  const start = new Date(`${endDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString().slice(0, 10);
}

interface ApplicationTotals {
  applications: number | null;
  bioApplications: number | null;
  applicationsByMedium: Record<string, number>;
}

/**
 * 스냅샷과 같은 7일 창으로 신청을 집계한다.
 *
 * 클릭한 날과 신청한 날이 다를 수 있어 창 정렬은 근사다. 경계에서는 분자와 분모가
 * 다른 사람을 셀 수 있으므로 applyRate는 추세로 읽어야 하고 소수점까지 믿을 값이 아니다.
 */
function totalsFor(applications: Application[], endDate: string): ApplicationTotals {
  const start = windowStart(endDate, ACCOUNT_FUNNEL_WINDOW_DAYS);
  const byMedium: Record<string, number> = {};
  let total = 0;
  let bio = 0;

  for (const application of applications) {
    const day = application.submittedAt.slice(0, 10);
    if (day < start || day > endDate) continue;
    total += 1;
    const medium = application.medium ?? "unknown";
    byMedium[medium] = (byMedium[medium] ?? 0) + 1;
    if (medium === "bio") bio += 1;
  }

  return { applications: total, bioApplications: bio, applicationsByMedium: byMedium };
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
export function buildAccountFunnel(
  snapshots: AccountSnapshot[],
  applications?: Application[],
): AccountFunnel | null {
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

  // 미연동과 "신청 0건"은 다르다. 0으로 채우면 전환율 0%로 읽혀 폼이 죽은 것처럼 보인다.
  const totals: ApplicationTotals =
    applications === undefined
      ? { applications: null, bioApplications: null, applicationsByMedium: {} }
      : totalsFor(applications, latest.date);

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
    ...totals,
    applyRate: rate(totals.bioApplications, websiteClicks),
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
