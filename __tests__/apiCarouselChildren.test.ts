// 캐러셀 낱장 조회 라우트. 저장된 URL은 서명이 만료되므로 이 라우트는 열 때마다
// Graph에 다시 물어본다 — 영상 받기(getMediaUrl)와 같은 이유다.
vi.mock("@/lib/store", () => ({ getRepository: vi.fn() }));
vi.mock("@/lib/graph", () => ({ getInstagramClient: vi.fn() }));

import type { Mock } from "vitest";
import { GET } from "@/app/api/reels/[id]/children/route";
import { getRepository } from "@/lib/store";
import { getInstagramClient } from "@/lib/graph";

const mockGetRepository = getRepository as unknown as Mock;
const mockGetInstagramClient = getInstagramClient as unknown as Mock;

const carousel = {
  id: "c1",
  mediaType: "CAROUSEL" as const,
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 0,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 1,
  avgWatchTimeSec: 0,
};

const repo = { get: vi.fn() };

function ctx(id = "c1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function request(): Request {
  return new Request("http://localhost:3000/api/reels/c1/children");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRepository.mockReturnValue(repo);
  repo.get.mockResolvedValue({ ...carousel });
});

test("없는 게시물은 404", async () => {
  repo.get.mockResolvedValue(null);

  const res = await GET(request(), ctx());

  expect(res.status).toBe(404);
});

test("릴스에는 낱장이 없다 — 400으로 사유를 알린다", async () => {
  repo.get.mockResolvedValue({ ...carousel, mediaType: "REELS" });

  const res = await GET(request(), ctx());

  expect(res.status).toBe(400);
  expect((await res.json()).error).toContain("캐러셀");
});

test("연결이 없으면 400 — 사용자가 설정에서 고칠 수 있는 문제다", async () => {
  mockGetInstagramClient.mockRejectedValue(new Error("Instagram 토큰이 없습니다"));

  const res = await GET(request(), ctx());

  expect(res.status).toBe(400);
  expect((await res.json()).error).toContain("토큰");
});

test("낱장 주소를 순서대로 돌려준다", async () => {
  const getCarouselChildren = vi.fn(async () => [
    { id: "1", kind: "IMAGE" as const, url: "https://cdn/1.jpg", posterUrl: undefined },
    { id: "2", kind: "VIDEO" as const, url: "https://cdn/2.mp4", posterUrl: "https://cdn/2.jpg" },
  ]);
  mockGetInstagramClient.mockResolvedValue({ getCarouselChildren });

  const res = await GET(request(), ctx());

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    slides: [
      { id: "1", kind: "IMAGE", url: "https://cdn/1.jpg" },
      { id: "2", kind: "VIDEO", url: "https://cdn/2.mp4", posterUrl: "https://cdn/2.jpg" },
    ],
  });
  expect(getCarouselChildren).toHaveBeenCalledWith("c1");
});

test("Graph가 실패하면 502로 사유를 그대로 전한다", async () => {
  mockGetInstagramClient.mockResolvedValue({
    getCarouselChildren: vi.fn(async () => {
      throw new Error("Graph API 오류 (children)");
    }),
  });

  const res = await GET(request(), ctx());

  expect(res.status).toBe(502);
  expect((await res.json()).error).toContain("Graph API 오류");
});
