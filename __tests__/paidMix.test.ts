import { flattenInsights } from "@/lib/graph/map";
import { createGraphClient } from "@/lib/graph/client";
import { buildPaidMix } from "@/lib/analysis/paidMix";
import type { AccountSnapshot } from "@/lib/schemas";

// 실제 v23.0 응답 형태. reach의 breakdown 합(15,228)은 면 간 중복 제거 때문에
// total_value(13,922)보다 크다 — 비중 분모를 total_value로 잡으면 100%를 넘는다.
function productTypeResponse(name: string, total: number, results: Array<[string, number]>) {
  return {
    data: [
      {
        name,
        total_value: {
          value: total,
          breakdowns: [
            {
              dimension_keys: ["media_product_type"],
              results: results.map(([dimension, value]) => ({
                dimension_values: [dimension],
                value,
              })),
            },
          ],
        },
      },
    ],
  };
}

test("flattenInsights는 media_product_type breakdown을 광고와 오가닉으로 가른다", () => {
  const values = flattenInsights(
    productTypeResponse("views", 34823, [
      ["AD", 2225],
      ["POST", 1],
      ["CAROUSEL_CONTAINER", 9985],
      ["REEL", 17380],
      ["STORY", 5232],
    ]),
  );

  expect(values.views).toBe(34823);
  expect(values.views_ad).toBe(2225);
  // 오가닉은 AD를 뺀 나머지 면의 합이다. total_value에서 빼면 중복 제거분만큼 어긋난다.
  expect(values.views_organic).toBe(32598);
});

test("flattenInsights는 reach와 total_interactions도 같은 방식으로 가른다", () => {
  const reach = flattenInsights(
    productTypeResponse("reach", 13922, [
      ["AD", 2341],
      ["CAROUSEL_CONTAINER", 1390],
      ["STORY", 255],
      ["REEL", 11242],
    ]),
  );
  expect(reach.reach_ad).toBe(2341);
  expect(reach.reach_organic).toBe(12887);

  const interactions = flattenInsights(
    productTypeResponse("total_interactions", 1109, [
      ["AD", 43],
      ["POST", 404],
      ["STORY", 45],
      ["REEL", 617],
    ]),
  );
  expect(interactions.total_interactions_ad).toBe(43);
  expect(interactions.total_interactions_organic).toBe(1066);
});

test("광고를 한 건도 집행하지 않으면 AD 차원이 없고 광고분은 0이다", () => {
  const values = flattenInsights(
    productTypeResponse("views", 9000, [
      ["REEL", 6000],
      ["STORY", 3000],
    ]),
  );

  expect(values.views_ad).toBe(0);
  expect(values.views_organic).toBe(9000);
});

// URL 패턴별 가짜 응답. 먼저 매칭되는 키가 이긴다.
function fakeFetch(routes: Array<[string, unknown]>, seen?: string[]) {
  return async (url: string) => {
    seen?.push(url);
    const hit = routes.find(([k]) => url.includes(k));
    if (!hit) throw new Error("unexpected url");
    return { ok: true, json: async () => hit[1], text: async () => JSON.stringify(hit[1]) };
  };
}

const RANGE = { since: "2026-07-16", until: "2026-08-14" };

test("getAccountInsights는 같은 기간으로 media_product_type breakdown을 따로 요청한다", async () => {
  const seen: string[] = [];
  const client = createGraphClient({
    accessToken: "T",
    fetchImpl: fakeFetch(
      [
        ["breakdown=follow_type", { data: [] }],
        ["breakdown=media_product_type", productTypeResponse("views", 34823, [["AD", 2225], ["REEL", 32598]])],
        ["/me/insights", { data: [{ name: "views", total_value: { value: 34823 } }] }],
      ],
      seen,
    ),
  });

  const result = await client.getAccountInsights!(RANGE);

  const call = seen.find((url) => url.includes("breakdown=media_product_type"));
  expect(call).toBeDefined();
  expect(call).toContain("since=2026-07-16");
  expect(call).toContain("until=2026-08-14");
  expect(result.metrics.views_ad).toBe(2225);
  expect(result.availableMetrics).toContain("media_product_type");
});

test("media_product_type breakdown이 실패해도 나머지 계정 동기화는 멈추지 않는다", async () => {
  const client = createGraphClient({
    accessToken: "T",
    fetchImpl: async (url: string) => {
      if (url.includes("breakdown=media_product_type")) {
        return { ok: false, json: async () => ({ error: { message: "nope" } }), text: async () => "" };
      }
      return {
        ok: true,
        json: async () => ({ data: [{ name: "reach", total_value: { value: 3340 } }] }),
        text: async () => "",
      };
    },
  });

  const result = await client.getAccountInsights!(RANGE);

  expect(result.metrics.reach).toBe(3340);
  expect(result.metrics.views_ad).toBeUndefined();
  expect(result.unavailableMetrics).toContain("media_product_type");
});

function snapshot(overrides: Partial<AccountSnapshot>): AccountSnapshot {
  return { date: "2026-08-14", followerCount: 1000, reachLast7d: 0, ...overrides };
}

test("buildPaidMix는 광고/오가닉이 모두 있는 가장 최근 스냅샷을 쓴다", () => {
  const mix = buildPaidMix([
    snapshot({ date: "2026-08-10", paidReachLast7d: 100, organicReachLast7d: 900 }),
    snapshot({
      date: "2026-08-14",
      paidReachLast7d: 2341,
      organicReachLast7d: 12887,
      paidViewsLast7d: 2225,
      organicViewsLast7d: 32598,
      paidInteractionsLast7d: 43,
      organicInteractionsLast7d: 1066,
    }),
    // 값이 없는 최신 스냅샷은 건너뛴다 — 수집 전 기록이라 0이 아니라 미지다.
    snapshot({ date: "2026-08-15" }),
  ]);

  expect(mix).not.toBeNull();
  expect(mix!.date).toBe("2026-08-14");
  expect(mix!.reach.paid).toBe(2341);
  expect(mix!.reach.total).toBe(15228);
  expect(mix!.reach.paidShare).toBeCloseTo(15.37, 1);
  expect(mix!.views!.paidShare).toBeCloseTo(6.39, 1);
  expect(mix!.interactions!.paid).toBe(43);
  expect(mix!.hasPaid).toBe(true);
});

test("buildPaidMix는 조회수·상호작용이 없어도 도달만으로 성립한다", () => {
  const mix = buildPaidMix([snapshot({ paidReachLast7d: 10, organicReachLast7d: 90 })]);

  expect(mix!.reach.paidShare).toBe(10);
  expect(mix!.views).toBeUndefined();
  expect(mix!.interactions).toBeUndefined();
});

test("광고 집행이 없던 기간은 hasPaid가 false다", () => {
  const mix = buildPaidMix([snapshot({ paidReachLast7d: 0, organicReachLast7d: 900 })]);

  expect(mix!.hasPaid).toBe(false);
  expect(mix!.reach.paidShare).toBe(0);
});

test("breakdown을 수집하기 전 스냅샷만 있으면 null이다", () => {
  expect(buildPaidMix([snapshot({ reachLast7d: 900 })])).toBeNull();
  expect(buildPaidMix([])).toBeNull();
});
