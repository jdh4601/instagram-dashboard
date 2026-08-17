vi.mock("@/lib/ads", () => ({
  getAdsConnection: vi.fn(),
}));

import type { MockedFunction } from "vitest";
import { fetchAdPerformance, clearAdPerformanceCache, AD_CACHE_TTL_MS } from "@/lib/ads/cache";
import { getAdsConnection } from "@/lib/ads";
import { AdsRequestError } from "@/lib/ads/client";
import type { AdPerformance } from "@/lib/ads/map";

const mockConnection = getAdsConnection as MockedFunction<typeof getAdsConnection>;

function perf(mediaId: string, spend = 1000): AdPerformance {
  return { mediaId, adCount: 1, spend, reach: 100, impressions: 200, clicks: 5 };
}

/** listAdPerformance를 세는 가짜 연결. 호출 횟수로 캐시 적중을 판정한다. */
function connectionReturning(rows: AdPerformance[]) {
  const listAdPerformance = vi.fn(async () => rows);
  mockConnection.mockResolvedValue({
    client: { listAdPerformance } as never,
    adAccountId: "act_1",
  });
  return listAdPerformance;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAdPerformanceCache();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-17T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchAdPerformance", () => {
  it("광고 연동이 없으면 빈 성과를 미연동으로 알린다", async () => {
    mockConnection.mockResolvedValue(null);

    const result = await fetchAdPerformance();

    expect(result.configured).toBe(false);
    expect(result.performance).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("연동돼 있으면 Marketing API 성과를 그대로 준다", async () => {
    connectionReturning([perf("m1", 4200)]);

    const result = await fetchAdPerformance();

    expect(result.configured).toBe(true);
    expect(result.performance).toEqual([perf("m1", 4200)]);
    expect(result.error).toBeNull();
  });

  it("TTL 안에서는 API를 다시 부르지 않는다", async () => {
    const list = connectionReturning([perf("m1")]);

    await fetchAdPerformance();
    vi.setSystemTime(new Date(Date.now() + AD_CACHE_TTL_MS - 1000));
    const second = await fetchAdPerformance();

    expect(list).toHaveBeenCalledTimes(1);
    expect(second.performance).toEqual([perf("m1")]);
  });

  it("TTL이 지나면 다시 부른다", async () => {
    const list = connectionReturning([perf("m1")]);

    await fetchAdPerformance();
    vi.setSystemTime(new Date(Date.now() + AD_CACHE_TTL_MS + 1000));
    await fetchAdPerformance();

    expect(list).toHaveBeenCalledTimes(2);
  });

  it("force면 TTL이 남아 있어도 다시 부른다 — 동기화가 쓰는 길이다", async () => {
    const list = connectionReturning([perf("m1")]);

    await fetchAdPerformance();
    await fetchAdPerformance({ force: true });

    expect(list).toHaveBeenCalledTimes(2);
  });

  it("실패는 캐시하지 않아 다음 호출에서 다시 시도한다", async () => {
    const listAdPerformance = vi
      .fn<() => Promise<AdPerformance[]>>()
      .mockRejectedValueOnce(new AdsRequestError("광고 계정을 읽지 못했습니다"))
      .mockResolvedValueOnce([perf("m1")]);
    mockConnection.mockResolvedValue({
      client: { listAdPerformance } as never,
      adAccountId: "act_1",
    });

    const failed = await fetchAdPerformance();
    expect(failed.error).toBe("광고 계정을 읽지 못했습니다");
    expect(failed.performance).toEqual([]);
    expect(failed.configured).toBe(true);

    const retried = await fetchAdPerformance();
    expect(retried.error).toBeNull();
    expect(retried.performance).toEqual([perf("m1")]);
    expect(listAdPerformance).toHaveBeenCalledTimes(2);
  });

  it("토큰이 섞일 수 있는 낯선 예외는 일반 문구로 바꾼다", async () => {
    const listAdPerformance = vi
      .fn<() => Promise<AdPerformance[]>>()
      .mockRejectedValue(new Error("fetch failed: https://graph.facebook.com/?access_token=SECRET"));
    mockConnection.mockResolvedValue({
      client: { listAdPerformance } as never,
      adAccountId: "act_1",
    });

    const result = await fetchAdPerformance();

    expect(result.error).toBe("Marketing API에 연결하지 못했습니다");
    expect(result.error).not.toContain("SECRET");
  });
});
