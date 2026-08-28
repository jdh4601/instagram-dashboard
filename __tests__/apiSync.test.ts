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
// 토큰 갱신은 만료가 임박했을 때만 네트워크를 탄다. 기본은 "아직 아님"으로 두고,
// 실패를 확인하는 테스트에서만 결과를 바꾼다.
vi.mock("@/lib/instagram/tokenRefresh", () => ({
  refreshInstagramTokenIfDue: vi.fn(async () => ({ status: "skipped", reason: "not-due" })),
}));
// 광고도 선택 연동이다. 기본은 미연동으로 두고, 필요한 테스트에서만 켠다.
vi.mock("@/lib/ads/cache", () => ({
  fetchAdPerformance: vi.fn(),
}));

import type { MockedFunction } from "vitest";
import { POST } from "@/app/api/sync/route";
import { syncFromGraph } from "@/lib/graph/sync";
import { syncApplicationsIfConfigured } from "@/lib/walla/sync";
import { fetchAdPerformance } from "@/lib/ads/cache";
import { refreshInstagramTokenIfDue } from "@/lib/instagram/tokenRefresh";

const mockFetchAds = fetchAdPerformance as MockedFunction<typeof fetchAdPerformance>;
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
  mockFetchAds.mockReset();
  mockFetchAds.mockResolvedValue({ performance: [], configured: false, error: null });
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

// --- 광고 동기화 -----------------------------------------------------------

const adPerf = (mediaId: string) => ({
  mediaId,
  adCount: 1,
  spend: 5000,
  reach: 800,
  impressions: 1200,
  clicks: 40,
});

test("동기화는 캐시를 건너뛰고 광고 성과를 새로 받는다", async () => {
  // 동기화 버튼의 뜻은 "지금 상태를 다시 가져와라"다. 5분짜리 캐시가 그 뜻을
  // 가로채면 눌러도 안 바뀌는 버튼이 된다.
  mockSync.mockResolvedValue(okResult);

  await POST(syncRequest());

  expect(mockFetchAds).toHaveBeenCalledWith({ force: true });
});

test("동기화 결과에 받아온 광고 건수가 실린다", async () => {
  mockSync.mockResolvedValue(okResult);
  mockFetchAds.mockResolvedValue({
    performance: [adPerf("m1"), adPerf("m2")],
    configured: true,
    error: null,
  });

  const res = await POST(syncRequest());

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toMatchObject({ ads: { configured: true, count: 2 } });
});

test("광고 연동이 없으면 조용히 0건으로 둔다", async () => {
  // 안 붙인 사용자에게 오류처럼 보이면 안 된다.
  mockSync.mockResolvedValue(okResult);

  const res = await POST(syncRequest());
  const body = await res.json();

  expect(body.ads).toEqual({ configured: false, count: 0 });
  expect(body.errors).toEqual([]);
});

test("광고 조회가 실패해도 동기화는 성공하고 사유만 errors에 남는다", async () => {
  // 신청 폼과 같은 취급이다. 곁다리 연동 하나가 릴스·계정 지표를 날리면 안 된다.
  mockSync.mockResolvedValue(okResult);
  mockFetchAds.mockResolvedValue({
    performance: [],
    configured: true,
    error: "Marketing API에 연결하지 못했습니다",
  });

  const res = await POST(syncRequest());

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.syncedReels).toBe(2);
  expect(body.errors).toContain("Marketing API에 연결하지 못했습니다");
});

test("광고 조회가 예외를 던져도 동기화는 성공하되 사유를 남긴다", async () => {
  // 조용히 "미연동"으로 두면 아예 안 붙인 상태와 구분되지 않아, 끊긴 연동을
  // 아무도 눈치채지 못한다.
  mockSync.mockResolvedValue(okResult);
  mockFetchAds.mockRejectedValue(new Error("boom"));

  const res = await POST(syncRequest());

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.syncedReels).toBe(2);
  expect(body.ads).toEqual({ configured: false, count: 0 });
  expect(body.errors).toContain("광고 연동을 확인하지 못했습니다");
});

test("토큰 갱신 실패는 동기화를 막지 않고 사유만 남긴다", async () => {
  (refreshInstagramTokenIfDue as MockedFunction<typeof refreshInstagramTokenIfDue>).mockResolvedValueOnce({
    status: "failed",
    error: "Instagram 토큰이 이미 만료돼 갱신할 수 없습니다. /settings에서 다시 연결하세요.",
  });
  mockSync.mockResolvedValue(okResult);
  mockFetchAds.mockResolvedValue({ configured: false, performance: [], error: null });

  const res = await POST(syncRequest());

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.syncedReels).toBe(2);
  expect(body.errors).toContain(
    "Instagram 토큰이 이미 만료돼 갱신할 수 없습니다. /settings에서 다시 연결하세요.",
  );
});
