import type { Reel, AccountSnapshot, AccountProfile } from "@/lib/schemas";
import { sortByDate, latestFollowerDelta } from "@/lib/analysis/followerTrend";
import { comparisonPair, daysBetween } from "@/lib/analysis/comparisonWindow";

export interface AccountOverview {
  followers: number;
  followerDelta: number | null;
  reachLast7d: number;
  reachAvailable: boolean;
  /** 대시보드가 실제로 분석 중인 게시물 수. 사용자가 목록에서 세는 숫자와 같아야 한다. */
  contentCount: number;
  /** Instagram이 보고한 media_count. 실제 수집분과 다를 수 있어 병기용으로만 둔다. */
  profileMediaCount: number | null;
  avgEngagementRate: number;
  viewsLast7d: number | null;
  accountsEngagedLast7d: number | null;
  totalInteractionsLast7d: number | null;
  netFollowersLast7d: number | null;
  followConversionRateLast7d: number | null;
  followConversionSource: "api" | "snapshot" | null;
  deltas: AccountOverviewDeltas;
}

export interface MetricDelta {
  /** 최신 값 - 직전 값. 전환율에서는 퍼센트포인트(%p) 차이다. */
  absolute: number;
  /** 직전 값 대비 증감률. 직전 값이 0이면 계산하지 않는다. */
  relativePercent: number | null;
}

export interface AccountOverviewDeltas {
  followers: MetricDelta | null;
  reachLast7d: MetricDelta | null;
  viewsLast7d: MetricDelta | null;
  accountsEngagedLast7d: MetricDelta | null;
  totalInteractionsLast7d: MetricDelta | null;
  followConversionRateLast7d: MetricDelta | null;
}

function metricDelta(current: number | null, previous: number | null): MetricDelta | null {
  if (current === null || previous === null) return null;
  const absolute = current - previous;
  return {
    absolute,
    relativePercent: previous === 0 ? null : (absolute / previous) * 100,
  };
}

function hasReach(snapshot: AccountSnapshot | null): boolean {
  return snapshot !== null &&
    (snapshot.reachLast7d > 0 || snapshot.availableMetrics?.includes("reach") === true);
}

function followConversionAt(
  snapshot: AccountSnapshot | null,
  snapshots: AccountSnapshot[],
): { rate: number | null; source: "api" | "snapshot" | null } {
  if (!snapshot || snapshot.reachLast7d <= 0) return { rate: null, source: null };

  if (snapshot.followsLast7d !== undefined) {
    return {
      rate: (snapshot.followsLast7d / snapshot.reachLast7d) * 100,
      source: "api",
    };
  }

  const previous7d = [...snapshots]
    .reverse()
    .find((candidate) =>
      candidate.date !== snapshot.date && daysBetween(snapshot.date, candidate.date) >= 7
    ) ?? null;
  if (!previous7d) return { rate: null, source: null };

  const estimatedFollows = Math.max(0, snapshot.followerCount - previous7d.followerCount);
  return {
    rate: (estimatedFollows / snapshot.reachLast7d) * 100,
    source: "snapshot",
  };
}

// 상단 계정 개요 카드용 집계. 프로필 우선, 없으면 스냅샷/릴스에서 추론.
export function buildAccountOverview(
  reels: Reel[],
  snapshots: AccountSnapshot[],
  profile: AccountProfile | null,
): AccountOverview {
  const sorted = sortByDate(snapshots);
  // 비교 기준은 accountInsights와 공유한다. "직전 스냅샷"은 스냅샷 주기가 불규칙해
  // 하루 전일 수도 닷새 전일 수도 있고, 7일 롤링 지표를 그런 값과 비교하면 두 창이
  // 겹쳐 증감이 노이즈가 된다.
  const { current: latest, baseline: previous } = comparisonPair(sorted);
  const earlierThan = (snapshot: AccountSnapshot | null) =>
    snapshot === null ? [] : sorted.filter((s) => s.date < snapshot.date);
  const latestConversion = followConversionAt(latest, earlierThan(latest));
  const previousConversion = followConversionAt(previous, earlierThan(previous));

  const followers = profile?.followersCount ?? latest?.followerCount ?? 0;
  // Instagram의 media_count(23)와 실제 수집분(36)이 어긋난다. 집계 기준이 다르거나
  // 갱신이 지연된 값이라, 화면에는 대시보드가 실제로 분석 중인 개수를 쓴다.
  const contentCount = reels.length;

  const rates = reels
    .map((r) => r.derived?.engagementRate)
    .filter((v): v is number => typeof v === "number");
  const avgEngagementRate =
    rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

  return {
    followers,
    followerDelta: latestFollowerDelta(snapshots),
    reachLast7d: latest?.reachLast7d ?? 0,
    reachAvailable: hasReach(latest),
    contentCount,
    profileMediaCount: profile?.mediaCount ?? null,
    avgEngagementRate,
    viewsLast7d: latest?.viewsLast7d ?? null,
    accountsEngagedLast7d: latest?.accountsEngagedLast7d ?? null,
    totalInteractionsLast7d: latest?.totalInteractionsLast7d ?? null,
    netFollowersLast7d:
      latest?.followsLast7d !== undefined && latest.unfollowsLast7d !== undefined
        ? latest.followsLast7d - latest.unfollowsLast7d
        : null,
    followConversionRateLast7d: latestConversion.rate,
    followConversionSource: latestConversion.source,
    deltas: {
      followers: metricDelta(latest?.followerCount ?? null, previous?.followerCount ?? null),
      reachLast7d: metricDelta(
        hasReach(latest) ? latest?.reachLast7d ?? null : null,
        hasReach(previous) ? previous?.reachLast7d ?? null : null,
      ),
      viewsLast7d: metricDelta(latest?.viewsLast7d ?? null, previous?.viewsLast7d ?? null),
      accountsEngagedLast7d: metricDelta(
        latest?.accountsEngagedLast7d ?? null,
        previous?.accountsEngagedLast7d ?? null,
      ),
      totalInteractionsLast7d: metricDelta(
        latest?.totalInteractionsLast7d ?? null,
        previous?.totalInteractionsLast7d ?? null,
      ),
      followConversionRateLast7d: metricDelta(
        latestConversion.rate,
        previousConversion.rate,
      ),
    },
  };
}
