import type { GraphClient, GraphInsightResult } from "@/lib/graph/client";
import type { ReelRepository } from "@/lib/store/reelRepository";
import type { AccountRepository } from "@/lib/store/accountRepository";
import type { ProfileRepository } from "@/lib/store/profileRepository";
import type { ReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import { mapMediaToReel } from "@/lib/graph/map";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import type { Reel } from "@/lib/schemas";

export interface SyncResult {
  syncedReels: number;
  followerCount: number;
  username: string;
  availableMetrics: string[];
  unavailableMetrics: string[];
}

function daysBefore(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

// 기존 릴스가 있으면 스크린샷 출처 필드(길이·훅·잔존곡선·유입소스·자막)를 보존하고
// API 집계 수치만 갱신한다.
function mergeWithExisting(mapped: Reel, existing: Reel | null): Reel {
  if (!existing) return mapped;
  const preserveEditSkip = existing.skipRateSource === "EDIT";
  const skipRate = preserveEditSkip ? existing.skipRate : mapped.skipRate ?? existing.skipRate;
  const skipRateSource = preserveEditSkip
    ? "EDIT"
    : mapped.skipRateSource ?? existing.skipRateSource;
  const hookFromSkip = preserveEditSkip
    ? existing.hookRetention3s ?? (existing.skipRate != null ? 100 - existing.skipRate : undefined)
    : mapped.hookRetention3s ?? existing.hookRetention3s ?? (skipRate != null ? 100 - skipRate : undefined);
  return {
    ...mapped,
    durationSec: existing.durationSec || mapped.durationSec,
    avgWatchTimeSec: mapped.avgWatchTimeSec || existing.avgWatchTimeSec,
    totalInteractions: mapped.totalInteractions ?? existing.totalInteractions,
    totalWatchTimeSec: mapped.totalWatchTimeSec ?? existing.totalWatchTimeSec,
    replays: mapped.replays ?? existing.replays,
    totalPlays: mapped.totalPlays ?? existing.totalPlays,
    profileActivity: mapped.profileActivity ?? existing.profileActivity,
    hookRetention3s: hookFromSkip,
    skipRate,
    skipRateSource,
    retentionCurve: existing.retentionCurve,
    reachSources: existing.reachSources,
    audienceBreakdown: existing.audienceBreakdown,
    watchTimeBuckets: existing.watchTimeBuckets,
    followsFromReel: mapped.followsFromReel ?? existing.followsFromReel,
    profileVisits: mapped.profileVisits ?? existing.profileVisits,
    transcript: existing.transcript,
    caption: mapped.caption ?? existing.caption,
  };
}

export async function syncFromGraph(
  client: GraphClient,
  reelRepo: ReelRepository,
  accountRepo: AccountRepository,
  today: string,
  profileRepo?: ProfileRepository,
  historyRepo?: ReelHistoryRepository,
): Promise<SyncResult> {
  const emptyInsights: GraphInsightResult = { metrics: {}, availableMetrics: [], unavailableMetrics: [] };
  const accountInsightsPromise = client.getAccountInsights
    ? client.getAccountInsights({ since: daysBefore(today, 7), until: today })
    : Promise.resolve(emptyInsights);
  const [profile, reels, accountInsights] = await Promise.all([
    client.getProfile(),
    client.listReels(),
    accountInsightsPromise,
  ]);

  const availableMetrics = new Set(accountInsights.availableMetrics);
  const unavailableMetrics = new Set(accountInsights.unavailableMetrics);

  let synced = 0;
  for (const media of reels) {
    const insights = await client.getInsights(media.id);
    insights.availableMetrics.forEach((metric) => availableMetrics.add(metric));
    insights.unavailableMetrics.forEach((metric) => unavailableMetrics.add(metric));
    const mapped = mapMediaToReel(media, insights.metrics);
    const existing = await reelRepo.get(mapped.id);
    const merged = mergeWithExisting(mapped, existing);
    await reelRepo.upsert({ ...merged, derived: computeDerivedRates(merged) });
    // 동기화 시점의 지표를 이력으로 누적(조회수/도달 추이용)
    if (historyRepo) {
      await historyRepo.add({
        reelId: merged.id,
        date: today,
        views: merged.views,
        reach: merged.reach,
        likes: merged.likes,
        comments: merged.comments,
        saves: merged.saves,
        shares: merged.shares,
        totalInteractions: merged.totalInteractions,
        totalWatchTimeSec: merged.totalWatchTimeSec,
        replays: merged.replays,
        totalPlays: merged.totalPlays,
        followsFromReel: merged.followsFromReel,
        profileVisits: merged.profileVisits,
      });
    }
    synced++;
  }

  await accountRepo.add({
    date: today,
    followerCount: profile.followersCount,
    reachLast7d: accountInsights.metrics.reach ?? 0,
    viewsLast7d: accountInsights.metrics.views,
    accountsEngagedLast7d: accountInsights.metrics.accounts_engaged,
    totalInteractionsLast7d: accountInsights.metrics.total_interactions,
    followsLast7d: accountInsights.metrics.follows,
    unfollowsLast7d: accountInsights.metrics.unfollows,
    profileLinksTapsLast7d: accountInsights.metrics.profile_links_taps,
    availableMetrics: accountInsights.availableMetrics,
    unavailableMetrics: accountInsights.unavailableMetrics,
  });
  if (profileRepo) {
    await profileRepo.save({
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      followersCount: profile.followersCount,
      mediaCount: profile.mediaCount,
      updatedAt: today,
    });
  }
  return {
    syncedReels: synced,
    followerCount: profile.followersCount,
    username: profile.username,
    availableMetrics: [...availableMetrics].sort(),
    unavailableMetrics: [...unavailableMetrics].sort(),
  };
}
