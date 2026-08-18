// 스토리텔링 포맷 저장 라우트 테스트. 저장소는 임시 디렉터리의 JSON 파일을 쓰고,
// 릴스 저장소만 mock으로 대체해 "분석이 있는/없는 릴스"를 만든다.
vi.mock("@/lib/store", async () => {
  const { mkdtempSync } = await vi.importActual<typeof import("node:fs")>("node:fs");
  const { tmpdir } = await vi.importActual<typeof import("node:os")>("node:os");
  const { join } = await vi.importActual<typeof import("node:path")>("node:path");
  const { createJsonSavedStoryFormatRepository } = await vi.importActual<
    typeof import("@/lib/store/savedStoryFormatRepository")
  >("@/lib/store/savedStoryFormatRepository");
  const repo = createJsonSavedStoryFormatRepository(mkdtempSync(join(tmpdir(), "story-route-")));
  return {
    getSavedStoryFormatRepository: () => repo,
    getRepository: vi.fn(),
  };
});

import type { Mock } from "vitest";
import { GET, POST } from "@/app/api/story-formats/route";
import { DELETE } from "@/app/api/story-formats/[id]/route";
import { getRepository, getSavedStoryFormatRepository } from "@/lib/store";
import type { Reel, ReelAnalysis, SavedStoryFormat } from "@/lib/schemas";

const mockGetRepository = getRepository as unknown as Mock;

const story: ReelAnalysis["story"] = {
  formatId: "heros-journey",
  confidence: "high",
  rationale: "문제 → 실패 → 해법 순서가 그대로 나타난다",
  beats: [{ beatId: "intro", present: true, summary: "도입" }],
  secretSauceMet: "본인의 통증을 먼저 꺼낸다",
  secretSauceMissed: "실패 과정이 없다",
};

const analysis = { story } as ReelAnalysis;

function reel(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "r1",
    postedAt: "2026-08-01T00:00:00Z",
    durationSec: 40,
    views: 12000,
    reach: 9000,
    likes: 300,
    comments: 40,
    saves: 120,
    shares: 60,
    avgWatchTimeSec: 18,
    caption: "<Ep 6. 3년간 안 팔리던 텀블러>\n두 번째 줄",
    permalink: "https://www.instagram.com/reel/abc/",
    reelAnalysis: analysis,
    ...overrides,
  };
}

function useReels(reels: Reel[]): void {
  mockGetRepository.mockReturnValue({
    get: async (id: string) => reels.find((r) => r.id === id) ?? null,
  });
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/story-formats", {
    method: "POST",
    headers: { host: "localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(): Request {
  return new Request("http://localhost:3000/api/story-formats/r1", {
    method: "DELETE",
    headers: { host: "localhost:3000", "Content-Type": "application/json" },
  });
}

async function clearStore(): Promise<void> {
  const repo = getSavedStoryFormatRepository();
  for (const item of await repo.list()) await repo.remove(item.id);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await clearStore();
});

test("릴스 분석의 포맷 판정을 저장소에 담는다", async () => {
  useReels([reel()]);

  const res = await POST(postRequest({ reelId: "r1" }));
  expect(res.status).toBe(201);

  const body = (await res.json()) as { storyFormat: SavedStoryFormat };
  expect(body.storyFormat.story).toMatchObject({ formatId: "heros-journey", confidence: "high" });
  // 어느 릴스에서 나왔는지 잃으면 사례집으로 쓸 수 없다.
  expect(body.storyFormat.source).toMatchObject({
    reelId: "r1",
    title: "<Ep 6. 3년간 안 팔리던 텀블러>",
    permalink: "https://www.instagram.com/reel/abc/",
    views: 12000,
  });
});

test("같은 릴스를 다시 저장해도 줄이 늘지 않고 처음 담은 시각은 그대로다", async () => {
  useReels([reel()]);
  const first = (await (await POST(postRequest({ reelId: "r1" }))).json()) as {
    storyFormat: SavedStoryFormat;
  };

  const again = await POST(postRequest({ reelId: "r1" }));
  expect(again.status).toBe(200);
  const second = (await again.json()) as { storyFormat: SavedStoryFormat };

  expect(second.storyFormat.createdAt).toBe(first.storyFormat.createdAt);
  expect(await getSavedStoryFormatRepository().list()).toHaveLength(1);
});

test("아직 분석하지 않은 릴스는 저장할 게 없다고 알린다", async () => {
  useReels([reel({ reelAnalysis: undefined })]);

  const res = await POST(postRequest({ reelId: "r1" }));
  expect(res.status).toBe(400);
  expect((await res.json()).error).toContain("분석");
});

test("없는 릴스는 404", async () => {
  useReels([]);
  expect((await POST(postRequest({ reelId: "없음" }))).status).toBe(404);
});

test("reelId가 없는 본문은 400", async () => {
  useReels([reel()]);
  expect((await POST(postRequest({}))).status).toBe(400);
});

test("목록은 저장한 포맷을 그대로 돌려준다", async () => {
  useReels([reel()]);
  await POST(postRequest({ reelId: "r1" }));

  const body = (await (await GET()).json()) as { storyFormats: SavedStoryFormat[] };
  expect(body.storyFormats.map((item) => item.id)).toEqual(["r1"]);
});

test("삭제는 있으면 지우고 없으면 404", async () => {
  useReels([reel()]);
  await POST(postRequest({ reelId: "r1" }));

  const ctx = { params: Promise.resolve({ id: "r1" }) };
  expect((await DELETE(deleteRequest(), ctx)).status).toBe(200);
  expect(await getSavedStoryFormatRepository().list()).toEqual([]);
  expect(
    (await DELETE(deleteRequest(), { params: Promise.resolve({ id: "r1" }) })).status,
  ).toBe(404);
});
