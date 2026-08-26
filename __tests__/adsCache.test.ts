vi.mock("@/lib/ads", () => ({
  getAdsConnection: vi.fn(),
}));

import type { MockedFunction } from "vitest";
import type { AdPerformance } from "@/lib/ads/map";

/**
 * 광고 성과 캐시는 모듈 수준 변수라 테스트끼리 새어 나간다. 프로덕션이 쓰지 않는
 * 초기화 함수를 두는 대신, 테스트마다 모듈 레지스트리를 비우고 다시 들여와
 * 캐시가 빈 상태에서 시작하게 만든다.
 *
 * 리셋하면 mock 함수도 AdsRequestError 클래스도 새 인스턴스가 되므로, 세 모듈을
 * 같은 시점에 함께 받아 와야 instanceof 판정이 어긋나지 않는다.
 */
let fetchAdPerformance: typeof import("@/lib/ads/cache").fetchAdPerformance;
let AD_CACHE_TTL_MS: number;
let AdsRequestError: typeof import("@/lib/ads/client").AdsRequestError;
let mockConnection: MockedFunction<typeof import("@/lib/ads").getAdsConnection>;

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

beforeEach(async () => {
  vi.resetModules();

  const ads = await import("@/lib/ads");
  mockConnection = ads.getAdsConnection as MockedFunction<typeof ads.getAdsConnection>;
  mockConnection.mockReset();

  ({ AdsRequestError } = await import("@/lib/ads/client"));
  ({ fetchAdPerformance, AD_CACHE_TTL_MS } = await import("@/lib/ads/cache"));

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

  // 모듈을 새로 들여왔으니 캐시는 비어 있다. 첫 호출이 곧 캐시를 채우는 호출이다.
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
