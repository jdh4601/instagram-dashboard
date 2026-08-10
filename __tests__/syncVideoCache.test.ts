import { syncFromGraph } from "@/lib/graph/sync";
import type { GraphClient } from "@/lib/graph/client";
import { PRINCIPLE_IDS, type Reel } from "@/lib/schemas";

function graphClient(): GraphClient {
  const media = {
    id: "r1",
    media_product_type: "REELS",
    timestamp: "2026-06-01T00:00:00Z",
    media_url: "https://cdn.example/r1.mp4",
  };
  return {
    getProfile: async () => ({
      userId: "u1",
      username: "acct",
      followersCount: 100,
      mediaCount: 1,
    }),
    listMedia: async () => ({ analyzable: [media], allIds: ["r1"] }),
    getInsights: async () => ({
      metrics: { views: 100, reach: 90, likes: 5, comments: 1, saved: 2, shares: 1 },
      availableMetrics: [],
      unavailableMetrics: [],
    }),
  };
}

function repos(stored: Reel[] = []) {
  const reels = new Map(stored.map((r) => [r.id, r]));
  return {
    reelRepo: {
      list: async () => [...reels.values()],
      get: async (id: string) => reels.get(id) ?? null,
      upsert: async (reel: Reel) => {
        reels.set(reel.id, reel);
        return reel;
      },
      removeMany: async () => 0,
    },
    accountRepo: { list: async () => [], add: async (s: unknown) => s as never },
    reels,
  };
}

const noProbe = async () => null;

test("동기화는 캐시가 없는 릴스의 mp4를 받아 파일명을 남긴다", async () => {
  const { reelRepo, accountRepo, reels } = repos();
  const download = vi.fn(async () => ({ fileName: "r1.mp4", bytes: 10 }));

  await syncFromGraph(
    graphClient(),
    reelRepo,
    accountRepo,
    "2026-06-02",
    undefined,
    undefined,
    undefined,
    noProbe,
    download,
  );

  expect(download).toHaveBeenCalledWith("r1", "https://cdn.example/r1.mp4");
  expect(reels.get("r1")?.videoFile).toBe("r1.mp4");
});

test("이미 캐시된 릴스는 다시 받지 않는다", async () => {
  const existing = {
    id: "r1",
    postedAt: "2026-06-01T00:00:00Z",
    durationSec: 30,
    views: 10,
    reach: 9,
    likes: 1,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 5,
    videoFile: "r1.mp4",
  } satisfies Reel;
  const { reelRepo, accountRepo, reels } = repos([existing]);
  const download = vi.fn(async () => ({ fileName: "r1.mp4", bytes: 10 }));

  await syncFromGraph(
    graphClient(),
    reelRepo,
    accountRepo,
    "2026-06-02",
    undefined,
    undefined,
    undefined,
    noProbe,
    download,
  );

  expect(download).not.toHaveBeenCalled();
  // 동기화가 캐시 표시를 지우면 상세 화면이 매번 "영상 없음"으로 되돌아간다.
  expect(reels.get("r1")?.videoFile).toBe("r1.mp4");
});

test("영상 다운로드 실패가 동기화 전체를 실패로 만들지 않는다", async () => {
  const { reelRepo, accountRepo, reels } = repos();
  const download = vi.fn(async () => {
    throw new Error("CDN 만료");
  });

  const result = await syncFromGraph(
    graphClient(),
    reelRepo,
    accountRepo,
    "2026-06-02",
    undefined,
    undefined,
    undefined,
    noProbe,
    download,
  );

  expect(result.syncedReels).toBe(1);
  expect(reels.get("r1")?.videoFile).toBeUndefined();
});

test("동기화는 저장된 분석 캐시를 보존한다", async () => {
  const analysis = {
    summary: "요약",
    idea: { coreIdea: "a", valueProposition: "b", targetAudience: "c", differentiator: "d" },
    hook: { line: "훅", type: "curiosity" as const, template: "[x]하면 [y]", why: "이유" },
    story: {
      formatId: "heros-journey",
      confidence: "high" as const,
      rationale: "문제 → 해법",
      beats: [{ beatId: "intro", present: true, summary: "요약" }],
      secretSauceMet: "공감",
      secretSauceMissed: "증명",
    },
    principles: PRINCIPLE_IDS.map((id) => ({ id, score: 3, evidence: "근거", fix: "개선" })),
  };
  const existing = {
    id: "r1",
    postedAt: "2026-06-01T00:00:00Z",
    durationSec: 30,
    views: 10,
    reach: 9,
    likes: 1,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 5,
    reelAnalysis: analysis,
  } satisfies Reel;
  const { reelRepo, accountRepo, reels } = repos([existing]);

  await syncFromGraph(
    graphClient(),
    reelRepo,
    accountRepo,
    "2026-06-02",
    undefined,
    undefined,
    undefined,
    noProbe,
    async () => ({ fileName: "r1.mp4", bytes: 1 }),
  );

  expect(reels.get("r1")?.reelAnalysis?.summary).toBe("요약");
});
