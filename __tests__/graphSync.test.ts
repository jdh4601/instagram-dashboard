import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncFromGraph } from "@/lib/graph/sync";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository } from "@/lib/store/accountRepository";
import { createJsonProfileRepository } from "@/lib/store/profileRepository";
import { createJsonReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import type { GraphClient } from "@/lib/graph/client";
import type { Reel } from "@/lib/schemas";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "sync-"));
}

const fakeClient: GraphClient = {
  getProfile: async () => ({
    userId: "1",
    username: "founder",
    followersCount: 1500,
    avatarUrl: "https://cdn/a.jpg",
    mediaCount: 7,
  }),
  listMedia: async () => ({
    analyzable: [
      { id: "media-1", media_product_type: "REELS", caption: "API 캡션", timestamp: "2026-06-01T00:00:00+0000" },
    ],
    allIds: ["media-1"],
  }),
  getInsights: async () => ({
    metrics: { views: 12000, reach: 9000, likes: 400, comments: 8, saved: 50, shares: 200, total_interactions: 658, ig_reels_avg_watch_time: 21000, reels_skip_rate: 45, follows: 20, profile_visits: 100 },
    availableMetrics: ["views", "reach", "reels_skip_rate", "follows", "profile_visits"],
    unavailableMetrics: ["clips_replays_count"],
  }),
  getAccountInsights: async () => ({
    metrics: { reach: 5000, views: 7000, accounts_engaged: 320, total_interactions: 480, follows: 30, unfollows: 8 },
    availableMetrics: ["reach", "views", "accounts_engaged", "total_interactions", "follows_and_unfollows"],
    unavailableMetrics: ["profile_links_taps"],
  }),
};

test("동기화는 API 집계 수치를 갱신하고 기존 EDIT 분석값은 제거한다", async () => {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());

  // 과거 EDIT 기능으로 저장된 값이 있는 기존 릴스
  const existing: Reel = {
    id: "media-1", postedAt: "2026-06-01T00:00:00Z", durationSec: 53,
    views: 100, reach: 90, likes: 1, comments: 0, saves: 0, shares: 0, avgWatchTimeSec: 5,
    hookRetention3s: 42,
    skipRate: 31,
    skipRateSource: "EDIT",
    retentionCurve: [{ sec: 0, pct: 100 }, { sec: 3, pct: 42 }],
    reachSources: { reelsTab: 70, explore: 20 },
    audienceBreakdown: { followersPct: 30, nonFollowersPct: 70 },
    watchTimeBuckets: [{ label: "0~3초", pct: 40 }],
    followsFromReel: 12,
    profileVisits: 80,
    transcript: [{ startSec: 0, endSec: 3, text: "도입" }],
  };
  await reelRepo.upsert(existing);

  const result = await syncFromGraph(fakeClient, reelRepo, accountRepo, "2026-06-29");

  const updated = await reelRepo.get("media-1");
  expect(updated?.views).toBe(12000); // API로 갱신
  expect(updated?.avgWatchTimeSec).toBeCloseTo(21, 5);
  expect(updated?.durationSec).toBe(53); // 수동 입력 길이 보존
  expect(updated?.hookRetention3s).toBe(55); // API Skip Rate에서 계산
  expect(updated?.skipRate).toBe(45);
  expect(updated?.skipRateSource).toBe("API");
  expect(updated?.reachSources).toBeUndefined();
  expect(updated?.audienceBreakdown).toBeUndefined();
  expect(updated?.watchTimeBuckets).toBeUndefined();
  expect(updated?.followsFromReel).toBe(20); // Graph 값으로 갱신
  expect(updated?.profileVisits).toBe(100); // Graph 값으로 갱신
  expect(updated?.transcript?.[0].text).toBe("도입"); // 자막 보존
  expect(updated?.derived?.shareRate).toBeCloseTo(200 / 12000 * 100, 5);

  expect(result.syncedReels).toBe(1);
  const snaps = await accountRepo.list();
  expect(snaps[0]).toMatchObject({ date: "2026-06-29", followerCount: 1500, reachLast7d: 5000, viewsLast7d: 7000, followsLast7d: 30, unfollowsLast7d: 8 });
});

test("이력 저장소가 주어지면 동기화 시점 지표를 누적한다", async () => {
  const reels = createJsonReelRepository(tmpDir());
  const accounts = createJsonAccountRepository(tmpDir());
  const history = createJsonReelHistoryRepository(tmpDir());

  await syncFromGraph(fakeClient, reels, accounts, "2026-06-29", undefined, history);

  const h = await history.list("media-1");
  expect(h).toHaveLength(1);
  expect(h[0]).toMatchObject({ reelId: "media-1", date: "2026-06-29", views: 12000 });
});

test("캐시된 자막 심층 분석은 동기화 후에도 보존된다", async () => {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());

  const existing: Reel = {
    id: "media-1", postedAt: "2026-06-01T00:00:00Z", durationSec: 40,
    views: 100, reach: 90, likes: 1, comments: 0, saves: 0, shares: 0, avgWatchTimeSec: 5,
    transcriptInsights: {
      summary: "훅이 약하다",
      strengths: [{ title: "사례 인용", detail: "구체적 숫자를 들었다" }],
      weaknesses: [{ title: "도입 지연", detail: "본론까지 5초", metric: "skipRate" }],
      generatedAt: "2026-06-02T00:00:00Z",
    },
  };
  await reelRepo.upsert(existing);

  await syncFromGraph(fakeClient, reelRepo, accountRepo, "2026-06-29");

  const updated = await reelRepo.get("media-1");
  expect(updated?.transcriptInsights?.summary).toBe("훅이 약하다");
  expect(updated?.transcriptInsights?.weaknesses[0].title).toBe("도입 지연");
  expect(updated?.views).toBe(12000); // API 수치는 정상 갱신
});

test("프로필 저장소가 주어지면 계정 프로필을 저장한다", async () => {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());
  const profileRepo = createJsonProfileRepository(tmpDir());

  const result = await syncFromGraph(fakeClient, reelRepo, accountRepo, "2026-06-29", profileRepo);

  expect(result.username).toBe("founder");
  const profile = await profileRepo.get();
  expect(profile?.username).toBe("founder");
  expect(profile?.mediaCount).toBe(7);
  expect(profile?.avatarUrl).toBe("https://cdn/a.jpg");
});

test("신규 릴스는 길이 0(미상)으로 생성된다", async () => {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());
  await syncFromGraph(fakeClient, reelRepo, accountRepo, "2026-06-29");
  const created = await reelRepo.get("media-1");
  expect(created?.durationSec).toBe(0);
  expect(created?.views).toBe(12000);
});

test("과거 EDIT skipRate는 Graph 값으로 교체", async () => {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());

  const existing: Reel = {
    id: "media-1", postedAt: "2026-06-01T00:00:00Z", durationSec: 30,
    views: 100, reach: 90, likes: 1, comments: 0, saves: 0, shares: 0, avgWatchTimeSec: 5,
    skipRate: 68.56,
    skipRateSource: "EDIT",
  };
  await reelRepo.upsert(existing);

  await syncFromGraph(fakeClient, reelRepo, accountRepo, "2026-06-29");

  const updated = await reelRepo.get("media-1");
  expect(updated?.hookRetention3s).toBe(55);
  expect(updated?.skipRate).toBe(45);
  expect(updated?.skipRateSource).toBe("API");
});

test("Graph skipRate는 API 출처와 함께 신규 릴스에 저장", async () => {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());

  await syncFromGraph(fakeClient, reelRepo, accountRepo, "2026-06-29");

  const updated = await reelRepo.get("media-1");
  expect(updated?.skipRate).toBe(45);
  expect(updated?.hookRetention3s).toBe(55);
  expect(updated?.skipRateSource).toBe("API");
});
