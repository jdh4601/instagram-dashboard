// 자동 전사 라우트. 키 미설정 · 영상 없음 · 전사 실패를 서로 다른 메시지로 구분하는지 본다.
vi.mock("@/lib/store", () => ({ getRepository: vi.fn() }));
vi.mock("@/lib/runtime/config", () => ({ resolveRuntimeConfig: vi.fn() }));
vi.mock("@/lib/llm/transcription", () => ({ resolveTranscriptionCredentials: vi.fn() }));
vi.mock("@/lib/media/transcribe", async () => {
  const actual = await vi.importActual<typeof import("@/lib/media/transcribe")>(
    "@/lib/media/transcribe",
  );
  return { ...actual, transcribeVideoFile: vi.fn() };
});

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Mock } from "vitest";
import { POST } from "@/app/api/reels/[id]/transcript/whisper/route";
import { getRepository } from "@/lib/store";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { resolveTranscriptionCredentials } from "@/lib/llm/transcription";
import { transcribeVideoFile } from "@/lib/media/transcribe";
import { resolveCachedVideoPath, videoCacheDir } from "@/lib/media/videoCache";

const mockGetRepository = getRepository as unknown as Mock;
const mockResolveRuntimeConfig = resolveRuntimeConfig as unknown as Mock;
const mockCredentials = resolveTranscriptionCredentials as unknown as Mock;
const mockTranscribe = transcribeVideoFile as unknown as Mock;

const reel = {
  id: "r1",
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 1,
  avgWatchTimeSec: 10,
};

let dataDir = "";
const repo = { get: vi.fn(), upsert: vi.fn(async (r: unknown) => r) };

function ctx(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: "r1" }) };
}

function request(): Request {
  return new Request("http://localhost:3000/api/reels/r1/transcript/whisper", {
    method: "POST",
    headers: { host: "localhost:3000", "content-type": "application/json" },
  });
}

async function cacheVideo(): Promise<void> {
  await mkdir(videoCacheDir(dataDir), { recursive: true });
  await writeFile(resolveCachedVideoPath(dataDir, "r1"), "mp4");
}

beforeEach(async () => {
  vi.clearAllMocks();
  dataDir = await mkdtemp(join(tmpdir(), "whisper-api-"));
  mockResolveRuntimeConfig.mockReturnValue({ dataDir });
  mockGetRepository.mockReturnValue(repo);
  repo.get.mockResolvedValue({ ...reel });
  mockCredentials.mockResolvedValue({ apiKey: "sk-test", model: "whisper-1" });
});

test("없는 게시물은 404", async () => {
  repo.get.mockResolvedValue(null);
  expect((await POST(request(), ctx())).status).toBe(404);
});

test("OpenAI 키가 없으면 설정으로 안내한다", async () => {
  mockCredentials.mockResolvedValue(null);
  await cacheVideo();

  const res = await POST(request(), ctx());

  expect(res.status).toBe(400);
  expect((await res.json()).error).toMatch(/설정/);
  expect(mockTranscribe).not.toHaveBeenCalled();
});

test("내려받은 영상이 없으면 전사 대신 영상부터 받으라고 한다", async () => {
  const res = await POST(request(), ctx());

  expect(res.status).toBe(404);
  expect((await res.json()).error).toMatch(/영상/);
  expect(mockTranscribe).not.toHaveBeenCalled();
});

test("전사에 실패하면 사유를 담아 502를 준다", async () => {
  await cacheVideo();
  mockTranscribe.mockRejectedValue(new Error("Whisper 사용량 초과"));

  const res = await POST(request(), ctx());

  expect(res.status).toBe(502);
  expect((await res.json()).error).toMatch(/사용량 초과/);
  expect(repo.upsert).not.toHaveBeenCalled();
});

test("전사에 성공하면 기존 transcript 구조로 저장한다", async () => {
  await cacheVideo();
  mockTranscribe.mockResolvedValue([
    { startSec: 0, endSec: 1.5, text: "훅" },
    { startSec: 1.5, endSec: 3, text: "본론" },
  ]);

  const res = await POST(request(), ctx());

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, lineCount: 2 });
  expect(repo.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      transcript: [
        { startSec: 0, endSec: 1.5, text: "훅" },
        { startSec: 1.5, endSec: 3, text: "본론" },
      ],
    }),
  );
});
