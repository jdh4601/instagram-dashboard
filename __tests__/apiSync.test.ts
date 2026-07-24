jest.mock("@/lib/graph", () => ({
  getInstagramClient: jest.fn(async () => ({})),
}));
jest.mock("@/lib/store", () => ({
  getRepository: jest.fn(() => ({})),
  getAccountRepository: jest.fn(() => ({})),
  getProfileRepository: jest.fn(() => ({})),
  getReelHistoryRepository: jest.fn(() => ({})),
}));
jest.mock("@/lib/graph/sync", () => ({
  syncFromGraph: jest.fn(),
}));

import { POST } from "@/app/api/sync/route";
import { syncFromGraph } from "@/lib/graph/sync";

const mockSync = syncFromGraph as jest.MockedFunction<typeof syncFromGraph>;

function syncRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/sync", {
    method: "POST",
    headers: { host: "localhost:3000", ...headers },
  });
}

function streamRequest(): Request {
  return syncRequest({ accept: "application/x-ndjson" });
}

async function readEvents(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

const okResult = {
  syncedReels: 2,
  failedReels: 0,
  removedReels: 0,
  errors: [],
  followerCount: 100,
  username: "demo",
  availableMetrics: ["views"],
  unavailableMetrics: [],
};

beforeEach(() => {
  mockSync.mockReset();
});

test("POST /api/sync는 일부 릴스 실패를 207과 실패 상세로 반환한다", async () => {
  mockSync.mockResolvedValue({
    syncedReels: 2,
    failedReels: 1,
    removedReels: 0,
    errors: ["media-bad: permission denied"],
    followerCount: 100,
    username: "demo",
    availableMetrics: ["views"],
    unavailableMetrics: [],
  });

  const res = await POST(syncRequest());
  expect(res.status).toBe(207);
  await expect(res.json()).resolves.toMatchObject({
    syncedReels: 2,
    failedReels: 1,
    errors: ["media-bad: permission denied"],
  });
});

test("POST /api/sync는 전체 동기화 실패를 502로 반환한다", async () => {
  mockSync.mockRejectedValue(new Error("릴스 동기화 전체 실패"));

  const res = await POST(syncRequest());
  expect(res.status).toBe(502);
});

test("Accept 헤더가 없으면 기존 단일 JSON 응답을 그대로 쓴다", async () => {
  mockSync.mockResolvedValue(okResult);

  const res = await POST(syncRequest());
  expect(res.headers.get("content-type")).toContain("application/json");
  await expect(res.json()).resolves.toMatchObject({ syncedReels: 2 });
});

test("NDJSON을 요청하면 진행 상황을 줄 단위로 흘려보내고 결과로 끝낸다", async () => {
  mockSync.mockImplementation(async (...args) => {
    const onProgress = args[6] as ((p: { completed: number; total: number }) => void) | undefined;
    onProgress?.({ completed: 0, total: 2 });
    onProgress?.({ completed: 1, total: 2 });
    onProgress?.({ completed: 2, total: 2 });
    return okResult;
  });

  const res = await POST(streamRequest());
  expect(res.headers.get("content-type")).toContain("application/x-ndjson");

  const events = await readEvents(res);
  expect(events.slice(0, 3)).toEqual([
    { type: "progress", completed: 0, total: 2 },
    { type: "progress", completed: 1, total: 2 },
    { type: "progress", completed: 2, total: 2 },
  ]);
  expect(events[events.length - 1]).toMatchObject({ type: "result", syncedReels: 2 });
});

// 스트림은 헤더를 먼저 보내 상태 코드로 실패를 알릴 수 없다. 실패는 본문의 마지막
// 이벤트로 전달하고, 클라이언트는 이것을 502와 동등하게 다뤄야 한다.
test("스트리밍 중 동기화가 실패하면 error 이벤트로 끝낸다", async () => {
  mockSync.mockRejectedValue(new Error("릴스 동기화 전체 실패"));

  const res = await POST(streamRequest());
  const events = await readEvents(res);
  expect(events[events.length - 1]).toEqual({
    type: "error",
    error: "릴스 동기화 전체 실패",
  });
});
