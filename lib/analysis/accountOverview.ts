import type { Reel, AccountSnapshot, AccountProfile } from "@/lib/schemas";
import { sortByDate, latestFollowerDelta } from "@/lib/analysis/followerTrend";
import { averagePostHookRetention } from "@/lib/analysis/postHookRetention";

export interface AccountOverview {
  followers: number;
  followerDelta: number | null;
  reachLast7d: number;
  reachAvailable: boolean;
  reelCount: number;
  avgEngagementRate: number;
  avgPostHookRetention: number | null;
  viewsLast7d: number | null;
  accountsEngagedLast7d: number | null;
  totalInteractionsLast7d: number | null;
  netFollowersLast7d: number | null;
  profileLinksTapsLast7d: number | null;
}

// 상단 계정 개요 카드용 집계. 프로필 우선, 없으면 스냅샷/릴스에서 추론.
export function buildAccountOverview(
  reels: Reel[],
  snapshots: AccountSnapshot[],
  profile: AccountProfile | null,
): AccountOverview {
  const sorted = sortByDate(snapshots);
  const latest = sorted[sorted.length - 1] ?? null;

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
    reachAvailable:
      latest !== null &&
      (latest.reachLast7d > 0 || latest.availableMetrics?.includes("reach") === true),
    reelCount,
    avgEngagementRate,
    avgPostHookRetention: averagePostHookRetention(reels),
    viewsLast7d: latest?.viewsLast7d ?? null,
    accountsEngagedLast7d: latest?.accountsEngagedLast7d ?? null,
    totalInteractionsLast7d: latest?.totalInteractionsLast7d ?? null,
    netFollowersLast7d:
      latest?.followsLast7d !== undefined && latest.unfollowsLast7d !== undefined
        ? latest.followsLast7d - latest.unfollowsLast7d
        : null,
    profileLinksTapsLast7d: latest?.profileLinksTapsLast7d ?? null,
  };
}
