import type { AccountSnapshot } from "@/lib/schemas";

export const ACCOUNT_FUNNEL_WINDOW_DAYS = 7;

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
}

function rate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function optional(value: number | undefined): number | null {
  return typeof value === "number" ? value : null;
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

  return {
    date: latest.date,
    reach: latest.reachLast7d,
    profileViews,
    follows,
    unfollows,
    netFollows: follows === null || unfollows === null ? null : follows - unfollows,
    websiteClicks,
    viewRate: rate(profileViews, latest.reachLast7d),
    followRate: rate(follows, profileViews),
    linkClickRate: rate(websiteClicks, profileViews),
  };
}
