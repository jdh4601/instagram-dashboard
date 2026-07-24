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

// 분석 대상으로 분류된 목록과, 분류 실패분까지 포함한 원본 id 집합을 함께 돌려준다.
// extraIds는 응답에는 있었지만 classifyMedia가 인식하지 못한 미디어를 흉내낸다.
function clientWith(list: GraphMedia[], extraIds: string[] = []): GraphClient {
  return {
    getProfile: async () => ({
      userId: "1",
      username: "founder",
      followersCount: 1500,
      mediaCount: list.length,
    }),
    listMedia: async () => ({
      analyzable: list,
      allIds: [...list.map((m) => m.id), ...extraIds],
    }),
    getInsights: async () => ({
      metrics: { views: 1000, reach: 800, likes: 10, comments: 1, saved: 2, shares: 3 },
      availableMetrics: ["views", "reach"],
      unavailableMetrics: [],
    }),
    getAccountInsights: async () => ({ metrics: {}, availableMetrics: [], unavailableMetrics: [] }),
  };
}

beforeEach(() => {
  // 대량삭제 가드가 내보내는 경고가 테스트 출력을 더럽히지 않도록 잠근다.
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

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

test("분류에 실패한 살아있는 미디어는 삭제되지 않는다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  await reelRepo.upsert(storedReel("살아있음"));
  await reelRepo.upsert(storedReel("수수께끼"));

  // "수수께끼"는 응답에 존재하지만 classifyMedia가 인식하지 못해 analyzable에서 빠진 경우다.
  const result = await syncFromGraph(
    clientWith([media("살아있음")], ["수수께끼"]),
    reelRepo,
    accountRepo,
    "2026-06-29",
  );

  expect(result.removedReels).toBe(0);
  expect((await reelRepo.list()).map((r) => r.id).sort()).toEqual(["살아있음", "수수께끼"]);
});

test("한 번에 저장량의 30%를 넘게 지우려 하면 prune을 건너뛴다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  for (let i = 0; i < 10; i++) await reelRepo.upsert(storedReel(`게시물-${i}`));

  // 10건 중 1건만 살아있다고 응답 → 9건(90%) 삭제 시도
  const result = await syncFromGraph(
    clientWith([media("게시물-0")]),
    reelRepo,
    accountRepo,
    "2026-06-29",
  );

  expect(result.removedReels).toBe(0);
  expect(await reelRepo.list()).toHaveLength(10);
});

test("저장량이 가드 적용 최소치 미만이면 비율과 무관하게 삭제한다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  await reelRepo.upsert(storedReel("살아있음"));
  await reelRepo.upsert(storedReel("삭제됨"));

  // 2건 중 1건 삭제 = 50%지만, 표본이 작을 때 비율 가드를 걸면 정상 삭제를 막는다.
  const result = await syncFromGraph(
    clientWith([media("살아있음")]),
    reelRepo,
    accountRepo,
    "2026-06-29",
  );

  expect(result.removedReels).toBe(1);
  expect((await reelRepo.list()).map((r) => r.id)).toEqual(["살아있음"]);
});

test("저장된 캐러셀도 id가 사라지면 삭제되고 살아있으면 보존된다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  await reelRepo.upsert({ ...storedReel("캐러셀-생존"), mediaType: "CAROUSEL" });
  await reelRepo.upsert({ ...storedReel("캐러셀-삭제"), mediaType: "CAROUSEL" });
  await reelRepo.upsert(storedReel("릴스-생존"));

  const carousel: GraphMedia = {
    id: "캐러셀-생존",
    media_type: "CAROUSEL_ALBUM",
    media_product_type: "FEED",
    timestamp: "2026-06-01T00:00:00+0000",
  };
  const result = await syncFromGraph(
    clientWith([media("릴스-생존"), carousel]),
    reelRepo,
    accountRepo,
    "2026-06-29",
  );

  expect(result.removedReels).toBe(1);
  expect((await reelRepo.list()).map((r) => r.id).sort()).toEqual(["릴스-생존", "캐러셀-생존"]);
});
