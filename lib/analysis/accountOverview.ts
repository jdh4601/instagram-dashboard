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
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000;
}

// 상단 계정 개요 카드용 집계. 프로필 우선, 없으면 스냅샷/릴스에서 추론.
export function buildAccountOverview(
  reels: Reel[],
  snapshots: AccountSnapshot[],
  profile: AccountProfile | null,
): AccountOverview {
  const sorted = sortByDate(snapshots);
  const latest = sorted[sorted.length - 1] ?? null;
  const previous7d = latest
    ? [...sorted].reverse().find((snapshot) => snapshot.date !== latest.date && daysBetween(latest.date, snapshot.date) >= 7) ?? null
    : null;
  const followsForConversion = latest?.followsLast7d ??
    (latest && previous7d ? Math.max(0, latest.followerCount - previous7d.followerCount) : undefined);

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
    viewsLast7d: latest?.viewsLast7d ?? null,
    accountsEngagedLast7d: latest?.accountsEngagedLast7d ?? null,
    totalInteractionsLast7d: latest?.totalInteractionsLast7d ?? null,
    netFollowersLast7d:
      latest?.followsLast7d !== undefined && latest.unfollowsLast7d !== undefined
        ? latest.followsLast7d - latest.unfollowsLast7d
        : null,
    followConversionRateLast7d:
      followsForConversion !== undefined && latest !== null && latest.reachLast7d > 0
        ? (followsForConversion / latest.reachLast7d) * 100
        : null,
    followConversionSource:
      latest?.followsLast7d !== undefined
        ? "api"
        : followsForConversion !== undefined
          ? "snapshot"
          : null,
  };
}
