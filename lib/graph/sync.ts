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
  failedReels: number;
  errors: string[];
  followerCount: number;
  username: string;
  availableMetrics: string[];
  unavailableMetrics: string[];
}

// SyncResult.errors에 담는 릴스별 실패 메시지 상한(전체 실패 건수는 failedReels가 담는다).
const MAX_REPORTED_ERRORS = 5;

function daysBefore(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

// 기존 릴스가 있으면 수동 입력 길이·자막을 보존하고 API 집계 수치를 갱신한다.
function mergeWithExisting(mapped: Reel, existing: Reel | null): Reel {
  if (!existing) return mapped;
  const skipRate = mapped.skipRate ?? (existing.skipRateSource === "EDIT" ? undefined : existing.skipRate);
  const skipRateSource = mapped.skipRateSource ?? (existing.skipRateSource === "EDIT" ? undefined : existing.skipRateSource);
  const hookFromSkip = mapped.hookRetention3s ??
    (skipRate != null ? 100 - skipRate : existing.skipRateSource === "EDIT" ? undefined : existing.hookRetention3s);
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
  let failed = 0;
  const errors: string[] = [];
  // 릴스별 insight는 순차 호출한다(Graph API rate limit 완화). 한 릴스가 실패해도
  // (삭제된 미디어·권한 변경·일시적 5xx) 전체 동기화가 멈추지 않도록 개별 격리한다.
  for (const media of reels) {
    try {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed++;
      if (errors.length < MAX_REPORTED_ERRORS) errors.push(`${media.id}: ${message}`);
      console.error(`[sync] 릴스 ${media.id} 동기화 실패 — 건너뜁니다: ${message}`);
    }
  }

  // 동기화할 릴스가 있었는데 전부 실패하면 조용한 200 대신 예외를 던진다
  // (API 라우트가 502로 변환). 계정 스냅샷/프로필도 "정상 동기화"가 아니므로 남기지 않는다.
  if (reels.length > 0 && synced === 0 && failed > 0) {
    throw new Error(
      `릴스 동기화 전체 실패: ${failed}/${reels.length}개 릴스 모두 실패. 원인: ${errors.join(" | ")}`,
    );
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
    failedReels: failed,
    errors,
    followerCount: profile.followersCount,
    username: profile.username,
    availableMetrics: [...availableMetrics].sort(),
    unavailableMetrics: [...unavailableMetrics].sort(),
  };
}
