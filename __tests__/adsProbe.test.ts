import { probeAdsConnection } from "@/lib/ads/probe";
import { AdsRequestError, type AdsClient } from "@/lib/ads/client";
import { normalizeAdAccountId } from "@/lib/ads";
import type { AdPerformance } from "@/lib/ads/map";

const RANGE = { since: "2026-07-16", until: "2026-08-15" };

function client(impl: () => Promise<AdPerformance[]>): AdsClient {
  return { listAdAccounts: async () => [], listAdPerformance: impl };
}

function perf(mediaId: string, spend: number, adCount = 1): AdPerformance {
  return {
    mediaId,
    adCount,
    spend,
    reach: 100,
    impressions: 200,
    clicks: 5,
    actions: { likes: 1, comments: 0, shares: 0, saves: 0, linkClicks: 0, totalEngagement: 1 },
  };
}

test("광고가 게시물에 붙어 있으면 건수와 지출을 돌려준다", async () => {
  const result = await probeAdsConnection(
    client(async () => [perf("111", 30000, 2), perf("222", 20000)]),
    "act_1",
    RANGE,
  );

  expect(result).toMatchObject({ ok: true, postCount: 2, linkedAdCount: 3, spend: 50000 });
  expect(result.ok && result.emptyAccount).toBe(false);
});

// 실측에서 겪은 경로 — 자격증명은 멀쩡한데 앱 '홍보하기' 부스트가 Ad Center에
// 남아 표준 광고로 올라오지 않으면 표가 통째로 빈다.
test("자격증명은 통했는데 인스타에 붙은 광고가 없으면 그 상태를 구분해 알린다", async () => {
  const result = await probeAdsConnection(client(async () => []), "act_1", RANGE);

  expect(result).toMatchObject({ ok: true, emptyAccount: true, postCount: 0, spend: 0 });
});

test("토큰 거부와 계정 접근 불가를 구분한다 — 사용자가 고칠 곳이 다르다", async () => {
  const badToken = await probeAdsConnection(
    client(async () => {
      throw new AdsRequestError("expired", 190);
    }),
    "act_1",
    RANGE,
  );
  expect(badToken).toMatchObject({ ok: false, reason: "unauthorized" });

  const badAccount = await probeAdsConnection(
    client(async () => {
      throw new AdsRequestError("no permission", 100);
    }),
    "act_1",
    RANGE,
  );
  expect(badAccount).toMatchObject({ ok: false, reason: "accountNotFound" });
});

test("알 수 없는 오류는 원문을 흘리지 않는다", async () => {
  const result = await probeAdsConnection(
    client(async () => {
      throw new Error("token=SECRET leaked");
    }),
    "act_1",
    RANGE,
  );

  expect(result).toMatchObject({ ok: false, reason: "unreachable" });
  expect(result.ok === false && result.message).not.toContain("SECRET");
});

test("광고 계정 id에 act_ 접두어를 붙여 준다", () => {
  expect(normalizeAdAccountId("1628776048305774")).toBe("act_1628776048305774");
  expect(normalizeAdAccountId("act_1628776048305774")).toBe("act_1628776048305774");
  expect(normalizeAdAccountId("  act_123  ")).toBe("act_123");
  expect(normalizeAdAccountId("")).toBe("");
});
