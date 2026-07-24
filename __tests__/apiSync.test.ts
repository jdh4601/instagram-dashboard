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

function syncRequest(): Request {
  return new Request("http://localhost:3000/api/sync", {
    method: "POST",
    headers: { host: "localhost:3000" },
  });
}

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
