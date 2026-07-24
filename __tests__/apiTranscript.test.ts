// reels/[id]/transcript 업로드 검증 테스트. 저장소는 mock으로 대체한다.
jest.mock("@/lib/store", () => ({
  getRepository: jest.fn(),
}));

import { POST } from "@/app/api/reels/[id]/transcript/route";
import { getRepository } from "@/lib/store";

const mockGetRepository = getRepository as unknown as jest.Mock;

const fakeRepo = {
  get: jest.fn(async () => ({ id: "r1", postedAt: "2026-06-01T00:00:00Z" })),
  upsert: jest.fn(async (reel: unknown) => reel),
};

function ctx(id = "r1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function srtRequest(body: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost:3000/api/reels/r1/transcript", {
    method: "POST",
    headers: { "content-type": contentType, host: "localhost:3000" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRepository.mockReturnValue(fakeRepo);
});

test("512KB 초과 SRT는 413으로 거부하고 저장소를 읽지 않는다", async () => {
  const oversized = `1\n00:00:00,000 --> 00:00:01,000\n${"가".repeat(512 * 1024)}`;
  const res = await POST(srtRequest({ srt: oversized }), ctx());
  expect(res.status).toBe(413);
  expect(fakeRepo.get).not.toHaveBeenCalled();
});

test("Content-Length가 512KB를 초과하면 본문 파싱 전에 413으로 거부한다", async () => {
  const req = srtRequest({ srt: "작은 본문" });
  req.headers.set("content-length", String(512 * 1024 + 1));

  const jsonSpy = jest.spyOn(req, "json");
  const res = await POST(req, ctx());

  expect(res.status).toBe(413);
  expect(jsonSpy).not.toHaveBeenCalled();
});

test("srt 필드가 없거나 비어 있으면 400", async () => {
  expect((await POST(srtRequest({}), ctx())).status).toBe(400);
  expect((await POST(srtRequest({ srt: "   " }), ctx())).status).toBe(400);
  expect(fakeRepo.get).not.toHaveBeenCalled();
});

test("JSON 파싱이 불가능한 본문은 400", async () => {
  const res = await POST(srtRequest("not json at all{"), ctx());
  expect(res.status).toBe(400);
});

test("SRT 타임코드를 인식하지 못하면 422", async () => {
  const res = await POST(srtRequest({ srt: "자막 아님\n그냥 텍스트만 있는 파일" }), ctx());
  expect(res.status).toBe(422);
  expect(fakeRepo.upsert).not.toHaveBeenCalled();
});

test("text/plain 업로드는 가드가 415로 거부한다", async () => {
  const res = await POST(srtRequest("1\n00:00:00,000 --> 00:00:01,000\nhi", "text/plain"), ctx());
  expect(res.status).toBe(415);
  expect(fakeRepo.get).not.toHaveBeenCalled();
});

test("정상 SRT는 파싱해 저장한다", async () => {
  const srt = "1\n00:00:00,000 --> 00:00:02,000\n첫 번째 자막";
  const res = await POST(srtRequest({ srt }), ctx());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.lineCount).toBe(1);
  expect(fakeRepo.upsert).toHaveBeenCalledTimes(1);
});
