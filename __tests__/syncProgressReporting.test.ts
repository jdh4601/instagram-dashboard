import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncFromGraph, type SyncProgress } from "@/lib/graph/sync";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository } from "@/lib/store/accountRepository";
import type { GraphClient } from "@/lib/graph/client";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "sync-progress-"));
}

function clientWith(mediaIds: string[], failingIds: string[] = []): GraphClient {
  return {
    getProfile: async () => ({ userId: "1", username: "founder", followersCount: 100, mediaCount: mediaIds.length }),
    listMedia: async () => ({
      analyzable: mediaIds.map((id) => ({
        id,
        media_product_type: "REELS",
        timestamp: "2026-06-01T00:00:00+0000",
      })),
      allIds: mediaIds,
    }),
    getInsights: async (mediaId) => {
      if (failingIds.includes(mediaId)) throw new Error("권한 없음");
      return { metrics: { views: 10, reach: 8 }, availableMetrics: ["views"], unavailableMetrics: [] };
    },
  };
}

async function progressOf(client: GraphClient): Promise<SyncProgress[]> {
  const seen: SyncProgress[] = [];
  await syncFromGraph(
    client,
    createJsonReelRepository(tmpDir()),
    createJsonAccountRepository(tmpDir()),
    "2026-07-24",
    undefined,
    undefined,
    (progress) => seen.push(progress),
  );
  return seen;
}

test("목록을 받은 직후 총 개수를 먼저 알린다", async () => {
  const seen = await progressOf(clientWith(["a", "b", "c"]));
  expect(seen[0]).toEqual({ completed: 0, total: 3 });
});

test("게시물을 처리할 때마다 완료 수가 하나씩 오른다", async () => {
  const seen = await progressOf(clientWith(["a", "b", "c"]));
  expect(seen).toEqual([
    { completed: 0, total: 3 },
    { completed: 1, total: 3 },
    { completed: 2, total: 3 },
    { completed: 3, total: 3 },
  ]);
});

// 실패한 게시물도 "처리가 끝난" 것이다. 건너뛰면 막대가 100%에 닿지 못한다.
test("실패한 게시물도 진행률에 반영한다", async () => {
  const seen = await progressOf(clientWith(["a", "b", "c"], ["b"]));
  expect(seen[seen.length - 1]).toEqual({ completed: 3, total: 3 });
});

test("onProgress를 주지 않아도 동기화는 그대로 동작한다", async () => {
  const result = await syncFromGraph(
    clientWith(["a"]),
    createJsonReelRepository(tmpDir()),
    createJsonAccountRepository(tmpDir()),
    "2026-07-24",
  );
  expect(result.syncedReels).toBe(1);
});
