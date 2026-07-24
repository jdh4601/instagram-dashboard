import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncFromGraph } from "@/lib/graph/sync";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository } from "@/lib/store/accountRepository";
import { createJsonReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import type { GraphClient } from "@/lib/graph/client";
import type { GraphMedia } from "@/lib/graph/map";
import type { Reel } from "@/lib/schemas";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "sync-prune-"));
}

const media = (id: string): GraphMedia => ({
  id,
  media_product_type: "REELS",
  timestamp: "2026-06-01T00:00:00+0000",
});

const storedReel = (id: string): Reel => ({
  id,
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
  avgWatchTimeSec: 10,
});

function clientWith(list: GraphMedia[]): GraphClient {
  return {
    getProfile: async () => ({
      userId: "1",
      username: "founder",
      followersCount: 1500,
      mediaCount: list.length,
    }),
    listReels: async () => list,
    getInsights: async () => ({
      metrics: { views: 1000, reach: 800, likes: 10, comments: 1, saved: 2, shares: 3 },
      availableMetrics: ["views", "reach"],
      unavailableMetrics: [],
    }),
    getAccountInsights: async () => ({ metrics: {}, availableMetrics: [], unavailableMetrics: [] }),
  };
}

test("API 목록에 없는 저장 게시물은 삭제되고 removedReels에 집계된다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  await reelRepo.upsert(storedReel("살아있음"));
  await reelRepo.upsert(storedReel("삭제됨"));
  await reelRepo.upsert(storedReel("아카이브됨"));

  const result = await syncFromGraph(
    clientWith([media("살아있음")]),
    reelRepo,
    accountRepo,
    "2026-06-29",
  );

  expect(result.removedReels).toBe(2);
  expect((await reelRepo.list()).map((r) => r.id)).toEqual(["살아있음"]);
});

test("삭제된 게시물의 지표 이력도 함께 지운다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  const historyRepo = createJsonReelHistoryRepository(dir);
  await reelRepo.upsert(storedReel("삭제됨"));
  await historyRepo.add({
    reelId: "삭제됨",
    date: "2026-06-01",
    views: 100,
    reach: 90,
    likes: 5,
    comments: 1,
    saves: 2,
    shares: 3,
  });

  await syncFromGraph(
    clientWith([media("살아있음")]),
    reelRepo,
    accountRepo,
    "2026-06-29",
    undefined,
    historyRepo,
  );

  expect(await historyRepo.list("삭제됨")).toHaveLength(0);
});

test("API 목록이 0건이면 저장된 게시물을 지우지 않는다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  await reelRepo.upsert(storedReel("보존"));

  const result = await syncFromGraph(clientWith([]), reelRepo, accountRepo, "2026-06-29");

  expect(result.removedReels).toBe(0);
  expect(await reelRepo.list()).toHaveLength(1);
});

test("지울 게시물이 없으면 removedReels는 0이다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  await reelRepo.upsert(storedReel("살아있음"));

  const result = await syncFromGraph(
    clientWith([media("살아있음")]),
    reelRepo,
    accountRepo,
    "2026-06-29",
  );

  expect(result.removedReels).toBe(0);
  expect(await reelRepo.list()).toHaveLength(1);
});
