import type { Reel, AccountSnapshot, AccountProfile } from "@/lib/schemas";
import { sortByDate, latestFollowerDelta } from "@/lib/analysis/followerTrend";

export interface AccountOverview {
  followers: number;
  followerDelta: number | null;
  reachLast7d: number;
  reachAvailable: boolean;
  reelCount: number;
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

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000;
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
  const latest = sorted[sorted.length - 1] ?? null;
  const previous = sorted[sorted.length - 2] ?? null;
  const latestConversion = followConversionAt(latest, sorted.slice(0, -1));
  const previousConversion = followConversionAt(previous, sorted.slice(0, -2));

  const followers = profile?.followersCount ?? latest?.followerCount ?? 0;
  const reelCount = profile?.mediaCount ?? reels.length;

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
    reelCount,
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
