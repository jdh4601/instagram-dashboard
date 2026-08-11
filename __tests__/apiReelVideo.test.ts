// 캐시된 mp4 스트리밍 라우트. 저장소·런타임 설정·Graph 클라이언트는 mock으로 대체하고
// 파일 시스템만 실제 임시 디렉토리를 쓴다 — Range 응답은 실제 파일 없이는 의미가 없다.
vi.mock("@/lib/store", () => ({ getRepository: vi.fn() }));
vi.mock("@/lib/runtime/config", () => ({ resolveRuntimeConfig: vi.fn() }));
vi.mock("@/lib/graph", () => ({ getInstagramClient: vi.fn() }));

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Mock } from "vitest";
import { GET, POST } from "@/app/api/reels/[id]/video/route";
import { getRepository } from "@/lib/store";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { getInstagramClient } from "@/lib/graph";
import { resolveCachedVideoPath, videoCacheDir } from "@/lib/media/videoCache";

const mockGetRepository = getRepository as unknown as Mock;
const mockResolveRuntimeConfig = resolveRuntimeConfig as unknown as Mock;
const mockGetInstagramClient = getInstagramClient as unknown as Mock;

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

function ctx(id = "r1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function request(headers: Record<string, string> = {}, method = "GET"): Request {
  return new Request("http://localhost:3000/api/reels/r1/video", {
    method,
    headers: { host: "localhost:3000", ...headers },
  });
}

async function writeCachedVideo(bytes: string): Promise<void> {
  await mkdir(videoCacheDir(dataDir), { recursive: true });
  await writeFile(resolveCachedVideoPath(dataDir, "r1"), bytes);
}

beforeEach(async () => {
  vi.clearAllMocks();
  dataDir = await mkdtemp(join(tmpdir(), "reel-video-api-"));
  mockResolveRuntimeConfig.mockReturnValue({ dataDir });
  mockGetRepository.mockReturnValue(repo);
  repo.get.mockResolvedValue({ ...reel });
});

test("없는 게시물은 404", async () => {
  repo.get.mockResolvedValue(null);
  const res = await GET(request(), ctx());
  expect(res.status).toBe(404);
});

test("캐시가 없으면 무엇을 해야 하는지 알려주는 404를 준다", async () => {
  const res = await GET(request(), ctx());
  expect(res.status).toBe(404);
  expect((await res.json()).error).toMatch(/영상 받기/);
});

test("Range 없이 요청하면 전체를 200으로 보낸다", async () => {
  await writeCachedVideo("0123456789");
  const res = await GET(request(), ctx());

  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("video/mp4");
  expect(res.headers.get("accept-ranges")).toBe("bytes");
  expect(res.headers.get("content-length")).toBe("10");
  expect(await res.text()).toBe("0123456789");
});

test("Range 요청에는 206과 Content-Range로 그 구간만 보낸다", async () => {
  await writeCachedVideo("0123456789");
  const res = await GET(request({ range: "bytes=2-5" }), ctx());

  expect(res.status).toBe(206);
  expect(res.headers.get("content-range")).toBe("bytes 2-5/10");
  expect(res.headers.get("content-length")).toBe("4");
  expect(await res.text()).toBe("2345");
});

test("파일을 벗어난 범위는 416으로 거절한다", async () => {
  await writeCachedVideo("0123456789");
  const res = await GET(request({ range: "bytes=50-60" }), ctx());

  expect(res.status).toBe(416);
  expect(res.headers.get("content-range")).toBe("bytes */10");
});

test("경로 조작을 노린 id는 파일 시스템에 닿기 전에 400으로 막는다", async () => {
  repo.get.mockResolvedValue({ ...reel, id: "../../settings" });
  const res = await GET(request(), ctx("../../settings"));

  expect(res.status).toBe(400);
  expect(repo.upsert).not.toHaveBeenCalled();
});

test("영상 받기: 신선한 media_url을 받아 캐시하고 릴스에 파일명을 남긴다", async () => {
  const fetchImpl = vi.fn(
    async () => new Response(new Uint8Array([9, 9, 9]), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchImpl);
  mockGetInstagramClient.mockResolvedValue({
    getMediaUrl: vi.fn(async () => "https://cdn.example/x.mp4"),
  });

  const res = await POST(request({ "content-type": "application/json" }, "POST"), ctx());

  expect(res.status).toBe(200);
  expect((await res.json()).ok).toBe(true);
  expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({ videoFile: "r1.mp4" }));
  vi.unstubAllGlobals();
});

test("영상 받기: 토큰이 없으면 그 사유를 그대로 보여준다", async () => {
  mockGetInstagramClient.mockRejectedValue(new Error("Instagram 토큰이 없습니다."));
  const res = await POST(request({ "content-type": "application/json" }, "POST"), ctx());

  expect(res.status).toBe(400);
  expect((await res.json()).error).toMatch(/토큰/);
});

test("영상 받기: 인스타그램이 영상 주소를 주지 않으면 다운로드를 시도하지 않는다", async () => {
  mockGetInstagramClient.mockResolvedValue({ getMediaUrl: vi.fn(async () => null) });
  const res = await POST(request({ "content-type": "application/json" }, "POST"), ctx());

  expect(res.status).toBe(404);
  expect((await res.json()).error).toMatch(/영상 주소/);
  expect(repo.upsert).not.toHaveBeenCalled();
});

test("영상 받기: 다운로드가 실패하면 사유를 담아 502를 준다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 403 })));
  mockGetInstagramClient.mockResolvedValue({
    getMediaUrl: vi.fn(async () => "https://cdn.example/x.mp4"),
  });

  const res = await POST(request({ "content-type": "application/json" }, "POST"), ctx());

  expect(res.status).toBe(502);
  expect((await res.json()).error).toMatch(/403/);
  expect(repo.upsert).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test("영상 받기: text/plain 요청은 가드가 415로 막는다", async () => {
  const res = await POST(request({ "content-type": "text/plain" }, "POST"), ctx());
  expect(res.status).toBe(415);
});
