import type { GraphClient, GraphInsightResult } from "@/lib/graph/client";
import type { ReelRepository } from "@/lib/store/reelRepository";
import type { AccountRepository } from "@/lib/store/accountRepository";
import type { ProfileRepository } from "@/lib/store/profileRepository";
import type { ReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import { classifyMedia, mapMediaToReel, type GraphMedia } from "@/lib/graph/map";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { probeDurationSec } from "@/lib/media/probeDuration";
import type { MediaKind, Reel } from "@/lib/schemas";

/** media_url에서 영상 길이(초)를 읽는다. 실패는 null. */
export type DurationProbe = (mediaUrl: string) => Promise<number | null>;

/** 동기화 진행 상황. total은 목록을 받은 뒤에야 확정되므로 그 전에는 0이다. */
export interface SyncProgress {
  completed: number;
  total: number;
}

export interface SyncResult {
  syncedReels: number;
  failedReels: number;
  removedReels: number;
  errors: string[];
  followerCount: number;
  username: string;
  availableMetrics: string[];
  unavailableMetrics: string[];
}

// SyncResult.errors에 담는 릴스별 실패 메시지 상한(전체 실패 건수는 failedReels가 담는다).
const MAX_REPORTED_ERRORS = 5;

// 한 번의 동기화가 지울 수 있는 저장 게시물의 최대 비율. Graph가 이상 응답을 한 번
// 돌려줬을 때 저장소 전체가 날아가는 것을 막는 마지막 방어선이다. data/는 git이
// 추적하지 않고 원자적 쓰기도 백업을 남기지 않아 삭제를 되돌릴 방법이 없다.
const MAX_PRUNE_RATIO = 0.3;
// 표본이 작으면 정상 삭제도 비율 상한을 쉽게 넘긴다(3건 중 1건 = 33%). 저장량이
// 이 수 미만이면 비율 가드를 적용하지 않는다.
const PRUNE_GUARD_MIN_STORED = 5;

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
    // 자막 심층 분석은 LLM 호출 결과를 캐시한 것이라 API 응답에 없다. 보존하지 않으면
    // 동기화할 때마다 사라져 매번 다시 생성해야 한다.
    transcriptInsights: existing.transcriptInsights,
    caption: mapped.caption ?? existing.caption,
  };
}

/**
 * 길이를 모르는 릴스만 media_url에서 실측해 채운다.
 *
 * media_url은 서명·만료되는 CDN URL이라 나중에 따로 돌릴 수 없어 동기화 중에 처리한다.
 * 이미 길이가 있으면 호출하지 않는다 — 릴스 수만큼 네트워크 왕복이 늘어난다.
 * 캐러셀의 media_url은 첫 장 이미지라 대상이 아니다.
 */
async function withProbedDuration(
  reel: Reel,
  media: GraphMedia,
  kind: MediaKind,
  probe: DurationProbe,
): Promise<Reel> {
  if (kind !== "REELS" || reel.durationSec > 0 || !media.media_url) return reel;
  try {
    const durationSec = await probe(media.media_url);
    return durationSec === null ? reel : { ...reel, durationSec };
  } catch (err) {
    // 길이는 보조 지표다. 수집 실패가 게시물 동기화 자체를 실패로 만들면 안 된다.
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[sync] 릴스 ${reel.id} 길이 수집 실패 — 길이 미상으로 둡니다: ${message}`);
    return reel;
  }
}

export async function syncFromGraph(
  client: GraphClient,
  reelRepo: ReelRepository,
  accountRepo: AccountRepository,
  today: string,
  profileRepo?: ProfileRepository,
  historyRepo?: ReelHistoryRepository,
  onProgress?: (progress: SyncProgress) => void,
  probeDuration: DurationProbe = probeDurationSec,
): Promise<SyncResult> {
  const emptyInsights: GraphInsightResult = { metrics: {}, availableMetrics: [], unavailableMetrics: [] };
  const accountInsightsPromise = client.getAccountInsights
    ? client.getAccountInsights({ since: daysBefore(today, 7), until: today })
    : Promise.resolve(emptyInsights);
  const [profile, listing, accountInsights] = await Promise.all([
    client.getProfile(),
    client.listMedia(),
    accountInsightsPromise,
  ]);
  const mediaList = listing.analyzable;
  // 게시물당 Graph 호출을 순차로 돌려 전체 동기화는 수십 초가 걸린다. 총 개수를
  // 먼저 알려야 화면이 진행률 막대를 그릴 수 있다.
  onProgress?.({ completed: 0, total: mediaList.length });

  const availableMetrics = new Set(accountInsights.availableMetrics);
  const unavailableMetrics = new Set(accountInsights.unavailableMetrics);

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  // 릴스별 insight는 순차 호출한다(Graph API rate limit 완화). 한 릴스가 실패해도
  // (삭제된 미디어·권한 변경·일시적 5xx) 전체 동기화가 멈추지 않도록 개별 격리한다.
  for (const media of mediaList) {
    try {
      // listMedia가 이미 분석 대상만 통과시키므로 여기서 null이 나올 일은 없다.
      const kind = classifyMedia(media) ?? "REELS";
      const insights = await client.getInsights(media.id, kind);
      insights.availableMetrics.forEach((metric) => availableMetrics.add(metric));
      insights.unavailableMetrics.forEach((metric) => unavailableMetrics.add(metric));
      const mapped = mapMediaToReel(media, insights.metrics, kind);
      const existing = await reelRepo.get(mapped.id);
      const merged = await withProbedDuration(
        mergeWithExisting(mapped, existing),
        media,
        kind,
        probeDuration,
      );
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
    // 실패한 게시물도 처리가 끝난 것이라 진행률에 넣는다. 빼면 막대가 100%에 닿지 않는다.
    onProgress?.({ completed: synced + failed, total: mediaList.length });
  }

  // 동기화할 릴스가 있었는데 전부 실패하면 조용한 200 대신 예외를 던진다
  // (API 라우트가 502로 변환). 계정 스냅샷/프로필도 "정상 동기화"가 아니므로 남기지 않는다.
  if (mediaList.length > 0 && synced === 0 && failed > 0) {
    throw new Error(
      `릴스 동기화 전체 실패: ${failed}/${mediaList.length}개 릴스 모두 실패. 원인: ${errors.join(" | ")}`,
    );
  }

  // 인스타그램에서 삭제했거나 보관함으로 옮긴 게시물은 me/media 응답에서 사라진다.
  // API가 둘을 구분해 주지 않으므로 목록에 없는 저장 레코드는 모두 정리한다.
  //
  // 대조 대상은 분류된 목록이 아니라 응답에 존재한 모든 id다. 분류에 실패한 미디어를
  // 삭제로 오인하면(필드 누락·API 변경 등) 살아있는 게시물의 자막과 지표 이력이
  // 복구 불가능하게 사라진다.
  //
  // 목록이 0건이면 토큰 권한 이상일 수 있으므로 아예 건너뛴다.
  let removed = 0;
  if (listing.allIds.length > 0) {
    const liveIds = new Set(listing.allIds);
    const storedIds = (await reelRepo.list()).map((reel) => reel.id);
    const staleIds = storedIds.filter((id) => !liveIds.has(id));
    const exceedsGuard =
      storedIds.length >= PRUNE_GUARD_MIN_STORED &&
      staleIds.length > storedIds.length * MAX_PRUNE_RATIO;

    if (exceedsGuard) {
      console.warn(
        `[sync] 삭제 대상이 저장량의 ${Math.round(MAX_PRUNE_RATIO * 100)}%를 초과해 정리를 건너뜁니다 ` +
          `(${staleIds.length}/${storedIds.length}건). Graph 응답이 불완전한지 확인하세요.`,
      );
    } else if (staleIds.length > 0) {
      removed = await reelRepo.removeMany(staleIds);
      if (historyRepo) await historyRepo.removeByReelIds(staleIds);
    }
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
    profileViewsLast7d: accountInsights.metrics.profile_views,
    profileLinksTapsLast7d: accountInsights.metrics.profile_links_taps,
    followerReachLast7d: accountInsights.metrics.reach_follower,
    nonFollowerReachLast7d: accountInsights.metrics.reach_non_follower,
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
    removedReels: removed,
    errors,
    followerCount: profile.followersCount,
    username: profile.username,
    availableMetrics: [...availableMetrics].sort(),
    unavailableMetrics: [...unavailableMetrics].sort(),
  };
}
