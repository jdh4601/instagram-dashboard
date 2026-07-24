import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncFromGraph } from "@/lib/graph/sync";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository } from "@/lib/store/accountRepository";
import type { GraphClient } from "@/lib/graph/client";
import type { MediaKind } from "@/lib/schemas";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "sync-carousel-"));
}

// getInsights가 어떤 종류로 호출됐는지 기록하는 가짜 클라이언트
function recordingClient(seen: Record<string, MediaKind | undefined>): GraphClient {
  return {
    getProfile: async () => ({ userId: "1", username: "founder", followersCount: 100, mediaCount: 2 }),
    listMedia: async () => ({
      analyzable: [
        { id: "reel-1", media_product_type: "REELS", timestamp: "2026-06-01T00:00:00+0000" },
        {
          id: "carousel-1",
          media_type: "CAROUSEL_ALBUM",
          media_product_type: "FEED",
          timestamp: "2026-06-02T00:00:00+0000",
          media_url: "https://cdn/slide.jpg",
        },
      ],
      allIds: ["reel-1", "carousel-1"],
    }),
    getInsights: async (mediaId, kind) => {
      seen[mediaId] = kind;
      return {
        metrics: { views: 700, reach: 500, likes: 30, comments: 2, saved: 8, shares: 4 },
        availableMetrics: ["reach"],
        unavailableMetrics: [],
      };
    },
    getAccountInsights: async () => ({ metrics: {}, availableMetrics: [], unavailableMetrics: [] }),
  };
}

test("캐러셀은 CAROUSEL로 저장되고 릴스는 REELS로 저장된다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);

  const result = await syncFromGraph(recordingClient({}), reelRepo, accountRepo, "2026-06-29");

  expect(result.syncedReels).toBe(2);
  expect((await reelRepo.get("reel-1"))?.mediaType).toBe("REELS");
  expect((await reelRepo.get("carousel-1"))?.mediaType).toBe("CAROUSEL");
});

test("getInsights에 미디어 종류를 그대로 넘긴다", async () => {
  const dir = tmpDir();
  const seen: Record<string, MediaKind | undefined> = {};

  await syncFromGraph(
    recordingClient(seen),
    createJsonReelRepository(dir),
    createJsonAccountRepository(dir),
    "2026-06-29",
  );

  expect(seen["reel-1"]).toBe("REELS");
  expect(seen["carousel-1"]).toBe("CAROUSEL");
});

test("캐러셀은 첫 장 이미지를 썸네일로 저장한다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);

  await syncFromGraph(recordingClient({}), reelRepo, createJsonAccountRepository(dir), "2026-06-29");

  expect((await reelRepo.get("carousel-1"))?.thumbnailUrl).toBe("https://cdn/slide.jpg");
});
