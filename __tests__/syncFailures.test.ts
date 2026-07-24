import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncFromGraph } from "@/lib/graph/sync";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository } from "@/lib/store/accountRepository";
import type { GraphClient, GraphInsightResult } from "@/lib/graph/client";
import type { GraphMedia } from "@/lib/graph/map";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "sync-fail-"));
}

const reelMedia = (id: string): GraphMedia => ({
  id,
  media_product_type: "REELS",
  timestamp: "2026-06-01T00:00:00+0000",
});

const okInsights = (): GraphInsightResult => ({
  metrics: { views: 1000, reach: 800, likes: 10, comments: 1, saved: 2, shares: 3 },
  availableMetrics: ["views", "reach"],
  unavailableMetrics: [],
});

// failIds에 속한 릴스만 getInsights가 실패하는 가짜 클라이언트
function flakyClient(reels: GraphMedia[], failIds: string[]): GraphClient {
  return {
    getProfile: async () => ({
      userId: "1",
      username: "founder",
      followersCount: 1500,
      mediaCount: reels.length,
    }),
    listReels: async () => reels,
    getInsights: async (mediaId: string) => {
      if (failIds.includes(mediaId)) throw new Error(`권한 없음 (${mediaId})`);
      return okInsights();
    },
    getAccountInsights: async () => ({ metrics: {}, availableMetrics: [], unavailableMetrics: [] }),
  };
}

beforeEach(() => {
  // 개별 실패 케이스의 콘솔 에러 로그가 테스트 출력을 오염시키지 않도록 잠근다
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

test("모든 릴스가 실패하면 throw하고 계정 스냅샷을 남기지 않는다", async () => {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());
  const client = flakyClient(
    [reelMedia("media-1"), reelMedia("media-2")],
    ["media-1", "media-2"],
  );

  await expect(
    syncFromGraph(client, reelRepo, accountRepo, "2026-06-29"),
  ).rejects.toThrow(/2\/2개 릴스 모두 실패/);

  expect(await accountRepo.list()).toHaveLength(0);
  expect(await reelRepo.list()).toHaveLength(0);
});

test("일부 릴스만 실패하면 failedReels/errors를 담아 resolve된다", async () => {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());
  const client = flakyClient(
    [reelMedia("media-ok"), reelMedia("media-bad-1"), reelMedia("media-bad-2")],
    ["media-bad-1", "media-bad-2"],
  );

  const result = await syncFromGraph(client, reelRepo, accountRepo, "2026-06-29");

  expect(result.syncedReels).toBe(1);
  expect(result.failedReels).toBe(2);
  expect(result.errors).toHaveLength(2);
  expect(result.errors[0]).toContain("media-bad-1");
  expect(result.errors[1]).toContain("media-bad-2");
  // 부분 실패는 동기화 성공으로 간주하고 스냅샷을 남긴다
  expect(await accountRepo.list()).toHaveLength(1);
  const saved = await reelRepo.get("media-ok");
  expect(saved?.views).toBe(1000);
});

test("errors는 처음 5개만 담고 failedReels는 전체 실패 건수를 담는다", async () => {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());
  const reels = [
    reelMedia("media-ok"),
    ...Array.from({ length: 6 }, (_, i) => reelMedia(`media-bad-${i}`)),
  ];
  const client = flakyClient(reels, reels.slice(1).map((m) => m.id));

  const result = await syncFromGraph(client, reelRepo, accountRepo, "2026-06-29");

  expect(result.syncedReels).toBe(1);
  expect(result.failedReels).toBe(6);
  expect(result.errors).toHaveLength(5);
});

test("동기화할 릴스가 없으면 throw하지 않고 0/0으로 resolve된다", async () => {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());
  const client = flakyClient([], []);

  const result = await syncFromGraph(client, reelRepo, accountRepo, "2026-06-29");

  expect(result.syncedReels).toBe(0);
  expect(result.failedReels).toBe(0);
  expect(result.errors).toEqual([]);
  expect(await accountRepo.list()).toHaveLength(1);
});
