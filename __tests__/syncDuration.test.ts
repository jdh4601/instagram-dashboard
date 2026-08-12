import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncFromGraph } from "@/lib/graph/sync";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository } from "@/lib/store/accountRepository";
import type { GraphClient } from "@/lib/graph/client";
import type { GraphMedia } from "@/lib/graph/map";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "sync-duration-"));
}

const REEL: GraphMedia = {
  id: "reel-1",
  media_product_type: "REELS",
  media_url: "https://cdn.example/reel-1.mp4",
  timestamp: "2026-06-01T00:00:00+0000",
};

function clientWith(media: GraphMedia[]): GraphClient {
  return {
    getProfile: async () => ({ userId: "1", username: "founder", followersCount: 280, mediaCount: 1 }),
    listMedia: async () => ({ analyzable: media, allIds: media.map((m) => m.id) }),
    getInsights: async () => ({
      metrics: { views: 1000, reach: 800, likes: 10, comments: 1, saved: 2, shares: 3, ig_reels_avg_watch_time: 7000 },
      availableMetrics: ["views", "reach"],
      unavailableMetrics: [],
    }),
    getAccountInsights: async () => ({ metrics: { reach: 5000 }, availableMetrics: ["reach"], unavailableMetrics: [] }),
  };
}

interface SyncOverrides {
  download?: VideoDownloader;
  probeLocal?: LocalDurationProbe;
}

const noDownload: VideoDownloader = async () => {
  throw new Error("이 테스트는 영상을 받지 않는다");
};
const noLocalProbe: LocalDurationProbe = async () => null;

async function runSync(
  media: GraphMedia[],
  probe: Mock,
  seed?: { id: string; durationSec: number; videoFile?: string },
  overrides: SyncOverrides = {},
) {
  const reelRepo = createJsonReelRepository(tmpDir());
  const accountRepo = createJsonAccountRepository(tmpDir());
  if (seed) {
    await reelRepo.upsert({
      id: seed.id, postedAt: "2026-06-01T00:00:00Z", durationSec: seed.durationSec,
      views: 1, reach: 1, likes: 0, comments: 0, saves: 0, shares: 0, avgWatchTimeSec: 1,
      videoFile: seed.videoFile,
    });
  }
  const result = await syncFromGraph(
    clientWith(media), reelRepo, accountRepo, "2026-06-29", undefined, undefined, undefined, probe,
    overrides.download ?? noDownload,
    overrides.probeLocal ?? noLocalProbe,
  );
  return { result, reelRepo };
}

test("길이를 모르는 릴스는 media_url에서 길이를 수집해 저장한다", async () => {
  const probe = vi.fn().mockResolvedValue(62.5);
  const { reelRepo } = await runSync([REEL], probe);

  expect(probe).toHaveBeenCalledWith("https://cdn.example/reel-1.mp4");
  expect((await reelRepo.get("reel-1"))?.durationSec).toBe(62.5);
});

test("수집한 길이는 완료율 계산에 즉시 반영된다", async () => {
  const probe = vi.fn().mockResolvedValue(70);
  const { reelRepo } = await runSync([REEL], probe);

  // 평균 시청 7초 / 길이 70초 = 10%
  expect((await reelRepo.get("reel-1"))?.derived?.completionRate).toBeCloseTo(10, 5);
});

test("이미 길이가 있는 릴스는 ffprobe를 호출하지 않는다", async () => {
  const probe = vi.fn().mockResolvedValue(62.5);
  const { reelRepo } = await runSync([REEL], probe, { id: "reel-1", durationSec: 45 });

  expect(probe).not.toHaveBeenCalled();
  expect((await reelRepo.get("reel-1"))?.durationSec).toBe(45);
});

test("캐러셀의 media_url은 첫 장 이미지라 길이를 재지 않는다", async () => {
  const probe = vi.fn().mockResolvedValue(62.5);
  const carousel: GraphMedia = {
    id: "carousel-1", media_type: "CAROUSEL_ALBUM",
    media_url: "https://cdn.example/first-slide.jpg", timestamp: "2026-06-01T00:00:00+0000",
  };
  await runSync([carousel], probe);

  expect(probe).not.toHaveBeenCalled();
});

test("media_url이 없으면 조용히 건너뛴다", async () => {
  const probe = vi.fn();
  const { result } = await runSync([{ ...REEL, media_url: undefined }], probe);

  expect(probe).not.toHaveBeenCalled();
  expect(result.syncedReels).toBe(1);
});

test("길이 수집이 실패해도 동기화는 정상 집계된다", async () => {
  const probe = vi.fn().mockResolvedValue(null);
  const { result, reelRepo } = await runSync([REEL], probe);

  expect(result.syncedReels).toBe(1);
  expect(result.failedReels).toBe(0);
  expect((await reelRepo.get("reel-1"))?.durationSec).toBe(0);
});

test("원격 실측이 실패해도 방금 받아 둔 mp4에서 길이를 채운다", async () => {
  const probeLocal = vi.fn().mockResolvedValue(33.6);
  const { reelRepo } = await runSync([REEL], vi.fn().mockResolvedValue(null), undefined, {
    download: async () => ({ fileName: "reel-1.mp4", bytes: 10 }),
    probeLocal,
  });

  expect(probeLocal).toHaveBeenCalledWith("reel-1");
  expect((await reelRepo.get("reel-1"))?.durationSec).toBe(33.6);
});

// 실제로 막혔던 상태: Graph가 media_url을 주지 않아 원격 실측은 시도조차 못 하는데,
// mp4는 상세 화면의 '영상 받기'로 이미 받아 둔 릴스.
test("media_url이 없어도 이전에 받아 둔 mp4가 있으면 길이를 채운다", async () => {
  const remoteProbe = vi.fn();
  const probeLocal = vi.fn().mockResolvedValue(33.6);
  const { reelRepo } = await runSync(
    [{ ...REEL, media_url: undefined }],
    remoteProbe,
    { id: "reel-1", durationSec: 0, videoFile: "reel-1.mp4" },
    { probeLocal },
  );

  expect(remoteProbe).not.toHaveBeenCalled();
  expect((await reelRepo.get("reel-1"))?.durationSec).toBe(33.6);
});

test("로컬 실측으로 채운 길이는 완료율 계산에 즉시 반영된다", async () => {
  const probeLocal = vi.fn().mockResolvedValue(70);
  const { reelRepo } = await runSync(
    [{ ...REEL, media_url: undefined }],
    vi.fn(),
    { id: "reel-1", durationSec: 0, videoFile: "reel-1.mp4" },
    { probeLocal },
  );

  // 평균 시청 7초 / 길이 70초 = 10%
  expect((await reelRepo.get("reel-1"))?.derived?.completionRate).toBeCloseTo(10, 5);
});

test("원격 실측이 성공하면 로컬 mp4는 다시 재지 않는다", async () => {
  const probeLocal = vi.fn();
  const { reelRepo } = await runSync([REEL], vi.fn().mockResolvedValue(62.5), undefined, {
    download: async () => ({ fileName: "reel-1.mp4", bytes: 10 }),
    probeLocal,
  });

  expect(probeLocal).not.toHaveBeenCalled();
  expect((await reelRepo.get("reel-1"))?.durationSec).toBe(62.5);
});

test("받아 둔 mp4가 없으면 로컬 실측을 시도하지 않는다", async () => {
  const probeLocal = vi.fn();
  await runSync([{ ...REEL, media_url: undefined }], vi.fn(), undefined, { probeLocal });

  expect(probeLocal).not.toHaveBeenCalled();
});

test("로컬 실측이 예외를 던져도 게시물 동기화를 실패로 만들지 않는다", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const probeLocal = vi.fn().mockRejectedValue(new Error("ffprobe 폭발"));
  const { result, reelRepo } = await runSync(
    [{ ...REEL, media_url: undefined }],
    vi.fn(),
    { id: "reel-1", durationSec: 0, videoFile: "reel-1.mp4" },
    { probeLocal },
  );

  expect(result.syncedReels).toBe(1);
  expect(result.failedReels).toBe(0);
  expect((await reelRepo.get("reel-1"))?.durationSec).toBe(0);
  warn.mockRestore();
});

test("길이 수집이 예외를 던져도 게시물 동기화를 실패로 만들지 않는다", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const probe = vi.fn().mockRejectedValue(new Error("ffprobe 폭발"));
  const { result, reelRepo } = await runSync([REEL], probe);

  expect(result.syncedReels).toBe(1);
  expect(result.failedReels).toBe(0);
  expect((await reelRepo.get("reel-1"))?.views).toBe(1000);
  error.mockRestore();
});
import type { Mock } from "vitest";
import type { LocalDurationProbe, VideoDownloader } from "@/lib/graph/sync";
