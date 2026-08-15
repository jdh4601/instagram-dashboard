vi.mock("@/lib/store", () => ({ getHookRepository: vi.fn() }));
vi.mock("@/lib/runtime/config", () => ({ resolveRuntimeConfig: vi.fn() }));
vi.mock("@/lib/llm", () => ({ getVisionModel: vi.fn() }));
vi.mock("@/lib/llm/transcription", () => ({ resolveTranscriptionCredentials: vi.fn() }));
vi.mock("@/lib/reelBreakdown/pipeline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/reelBreakdown/pipeline")>(
    "@/lib/reelBreakdown/pipeline",
  );
  return { ...actual, runReelBreakdown: vi.fn() };
});

import type { Mock } from "vitest";
import { POST } from "@/app/api/hooks/[id]/breakdown/route";
import { getHookRepository } from "@/lib/store";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { getVisionModel } from "@/lib/llm";
import { resolveTranscriptionCredentials } from "@/lib/llm/transcription";
import { runReelBreakdown } from "@/lib/reelBreakdown/pipeline";
import type { Hook, HookBreakdown } from "@/lib/schemas";

const mockRepo = getHookRepository as unknown as Mock;
const mockRuntime = resolveRuntimeConfig as unknown as Mock;
const mockVision = getVisionModel as unknown as Mock;
const mockTranscription = resolveTranscriptionCredentials as unknown as Mock;
const mockRun = runReelBreakdown as unknown as Mock;

const hook: Hook = {
  id: "h1",
  text: "이 영상을 넘기면 손해입니다",
  category: "problem",
  sourceUrl: "https://www.instagram.com/reel/abc/",
  isFavorite: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const breakdown: HookBreakdown = {
  reelUrl: "https://www.instagram.com/reel/abc/",
  assetKey: "asset",
  durationSec: 10,
  cuts: [2],
  hookType: "warning",
  beats: Array.from({ length: 5 }, (_, index) => ({
    start: index * 2,
    end: (index + 1) * 2,
    label: index === 0 ? "훅" : `구간 ${index + 1}`,
    scene: "화자가 정면을 본다",
    original: "Original",
    translation: "번역",
    clipFile: `${index + 1}`.padStart(2, "0") + ".mp4",
    posterFile: `${index + 1}`.padStart(4, "0") + ".jpg",
  })),
  generatedAt: "2026-08-15T00:00:00.000Z",
};

const repo = { get: vi.fn(), upsert: vi.fn(async (value: Hook) => value) };

function request(): Request {
  return new Request("http://localhost:3000/api/hooks/h1/breakdown", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/x-ndjson" },
  });
}

const context = { params: Promise.resolve({ id: "h1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  repo.get.mockResolvedValue({ ...hook });
  mockRepo.mockReturnValue(repo);
  mockRuntime.mockReturnValue({ dataDir: "/tmp/data", isLocalRuntime: true });
  mockTranscription.mockResolvedValue({ apiKey: "sk", model: "whisper-1" });
  mockVision.mockResolvedValue({ generate: vi.fn() });
  mockRun.mockImplementation(async ({ onProgress }: { onProgress: (value: unknown) => void }) => {
    onProgress({ phase: "download", percent: 5, message: "받는 중" });
    return breakdown;
  });
});

test("없는 훅은 파이프라인을 시작하지 않고 404", async () => {
  repo.get.mockResolvedValue(null);
  const response = await POST(request(), context);

  expect(response.status).toBe(404);
  expect(mockRun).not.toHaveBeenCalled();
});

test("원본 링크가 없으면 400으로 수정 방법을 알려준다", async () => {
  repo.get.mockResolvedValue({ ...hook, sourceUrl: undefined });
  const response = await POST(request(), context);

  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatch(/원본 링크/);
});

test("서버리스에서는 로컬 바이너리 파이프라인을 열지 않는다", async () => {
  mockRuntime.mockReturnValue({ dataDir: "/tmp/data", isLocalRuntime: false });
  const response = await POST(request(), context);

  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatch(/로컬/);
});

test("진행 이벤트를 흘리고 최신 훅에 결과를 저장한다", async () => {
  const response = await POST(request(), context);
  const lines = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/x-ndjson");
  expect(lines[0]).toMatchObject({ type: "progress", phase: "download", percent: 5 });
  expect(lines.at(-1)).toMatchObject({ type: "result", breakdown });
  expect(repo.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ id: "h1", breakdown }),
  );
});

test("스트림 시작 뒤 실패는 error 이벤트로 전달한다", async () => {
  mockRun.mockRejectedValue(new Error("비공개 릴스"));
  const response = await POST(request(), context);
  const lines = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));

  expect(lines).toEqual([{ type: "error", error: "비공개 릴스" }]);
  expect(repo.upsert).not.toHaveBeenCalled();
});
