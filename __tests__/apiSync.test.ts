const mockMarkSynced = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@/lib/graph", () => ({
  getInstagramClient: vi.fn(async () => ({})),
}));
vi.mock("@/lib/store", () => ({
  getRepository: vi.fn(() => ({})),
  getAccountRepository: vi.fn(() => ({})),
  getProfileRepository: vi.fn(() => ({})),
  getReelHistoryRepository: vi.fn(() => ({})),
  getApplicationRepository: vi.fn(() => ({})),
}));
vi.mock("@/lib/graph/sync", () => ({
  syncFromGraph: vi.fn(),
}));
// 신청 폼은 선택 연동이다. 기본은 미연동으로 두고, 필요한 테스트에서만 켠다.
vi.mock("@/lib/walla", () => ({
  getWallaConnection: vi.fn(async () => null),
}));
vi.mock("@/lib/walla/sync", () => ({
  syncApplicationsIfConfigured: vi.fn(async () => ({
    applications: null,
    reachedPageLimit: false,
    error: null,
  })),
}));
vi.mock("@/lib/settings", () => ({
  getSettingsStore: vi.fn(() => ({ markSynced: mockMarkSynced })),
}));

import type { MockedFunction } from "vitest";
import { POST } from "@/app/api/sync/route";
import { syncFromGraph } from "@/lib/graph/sync";
import { syncApplicationsIfConfigured } from "@/lib/walla/sync";

const mockSync = syncFromGraph as MockedFunction<typeof syncFromGraph>;
const mockApplicationSync = syncApplicationsIfConfigured as MockedFunction<
  typeof syncApplicationsIfConfigured
>;

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
  mockMarkSynced.mockClear();
  mockApplicationSync.mockReset();
  mockApplicationSync.mockResolvedValue({
    applications: null,
    reachedPageLimit: false,
    error: null,
  });
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

// ── 마지막 동기화 시각 ────────────────────────────────────────────────

test("동기화가 성공하면 마지막 동기화 시각을 기록한다", async () => {
  mockSync.mockResolvedValue(okResult);

  await POST(syncRequest());

  expect(mockMarkSynced).toHaveBeenCalledTimes(1);
  const [recorded] = mockMarkSynced.mock.calls[0] as unknown as [string];
  expect(Number.isNaN(Date.parse(recorded))).toBe(false);
});

// 실패한 동기화가 시각을 밀면 낡은 데이터가 방금 갱신된 것처럼 보인다.
test("동기화가 실패하면 마지막 동기화 시각을 기록하지 않는다", async () => {
  mockSync.mockRejectedValue(new Error("릴스 동기화 전체 실패"));

  await POST(syncRequest());

  expect(mockMarkSynced).not.toHaveBeenCalled();
});

test("스트리밍 동기화가 실패해도 마지막 동기화 시각을 기록하지 않는다", async () => {
  mockSync.mockRejectedValue(new Error("릴스 동기화 전체 실패"));

  await readEvents(await POST(streamRequest()));

  expect(mockMarkSynced).not.toHaveBeenCalled();
});

// ── 신청 폼 연동 ───────────────────────────────────────────────────────

test("신청 폼이 연동돼 있으면 신청 수를 결과에 담는다", async () => {
  mockSync.mockResolvedValue(okResult);
  mockApplicationSync.mockResolvedValue({
    applications: 5,
    reachedPageLimit: false,
    error: null,
  });

  const res = await POST(syncRequest());

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ syncedReels: 2, applications: 5 });
});

test("신청 폼 미연동이면 applications가 null이다", async () => {
  mockSync.mockResolvedValue(okResult);

  const res = await POST(syncRequest());

  expect(await res.json()).toMatchObject({ applications: null });
});

test("신청 폼이 실패해도 Instagram 동기화 결과는 그대로 반환한다", async () => {
  // 키 만료나 Walla 장애로 릴스·계정 지표까지 날아가면 손해가 훨씬 크다.
  mockSync.mockResolvedValue(okResult);
  mockApplicationSync.mockResolvedValue({
    applications: null,
    reachedPageLimit: false,
    error: "Walla 요청 실패 (401): /forms/form_1/fields",
  });

  const res = await POST(syncRequest());

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.syncedReels).toBe(2);
  expect(body.errors).toContain("Walla 요청 실패 (401): /forms/form_1/fields");
});
