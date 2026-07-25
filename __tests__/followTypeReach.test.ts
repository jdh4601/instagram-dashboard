import { flattenInsights } from "@/lib/graph/map";
import { createGraphClient } from "@/lib/graph/client";

function breakdownResponse(follower: number, nonFollower: number) {
  return {
    data: [
      {
        name: "reach",
        total_value: {
          value: follower + nonFollower,
          breakdowns: [
            {
              dimension_keys: ["follow_type"],
              results: [
                { dimension_values: ["FOLLOWER"], value: follower },
                { dimension_values: ["NON_FOLLOWER"], value: nonFollower },
              ],
            },
          ],
        },
      },
    ],
  };
}

test("flattenInsights는 reach의 follow_type breakdown을 팔로워/비팔로워로 나눈다", () => {
  const values = flattenInsights(breakdownResponse(199, 3150));

  expect(values.reach).toBe(3349);
  expect(values.reach_follower).toBe(199);
  // NON_FOLLOWER 문자열에 "FOLLOWER"가 포함돼 뒤바뀌기 쉽다
  expect(values.reach_non_follower).toBe(3150);
});

test("breakdown이 없는 reach 응답은 그대로 둔다", () => {
  const values = flattenInsights({ data: [{ name: "reach", total_value: { value: 3340 } }] });

  expect(values.reach).toBe(3340);
  expect(values.reach_follower).toBeUndefined();
  expect(values.reach_non_follower).toBeUndefined();
});

// URL 패턴별 가짜 응답. 먼저 매칭되는 키가 이긴다.
function fakeFetch(routes: Array<[string, unknown]>) {
  return async (url: string) => {
    const hit = routes.find(([k]) => url.includes(k));
    if (!hit) throw new Error("unexpected url: " + url);
    return { ok: true, json: async () => hit[1], text: async () => JSON.stringify(hit[1]) };
  };
}

const RANGE = { since: "2026-07-18", until: "2026-07-25" };

test("getAccountInsights는 다른 계정 지표와 같은 기간으로 breakdown을 따로 요청한다", async () => {
  const seen: string[] = [];
  const routes: Array<[string, unknown]> = [
    ["breakdown=follow_type", breakdownResponse(199, 3150)],
    ["/me/insights", { data: [{ name: "reach", total_value: { value: 3340 } }] }],
  ];
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: (async (url: string) => {
      seen.push(url);
      return fakeFetch(routes)(url);
    }) as unknown as typeof fetch,
  });

  const result = await client.getAccountInsights!(RANGE);

  expect(result.metrics.reach_follower).toBe(199);
  expect(result.metrics.reach_non_follower).toBe(3150);
  const breakdownCall = seen.find((url) => url.includes("breakdown=follow_type"));
  // 기간이 어긋나면 화면에서 서로 다른 창의 숫자가 나란히 놓인다 (INS-1과 같은 종류의 모순)
  expect(breakdownCall).toContain(`since=${RANGE.since}`);
  expect(breakdownCall).toContain(`until=${RANGE.until}`);
});

test("breakdown 요청이 실패해도 나머지 계정 지표는 살아남는다", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: (async (url: string) => {
      if (url.includes("breakdown=follow_type")) {
        return {
          ok: false,
          json: async () => ({ error: { message: "Incompatible breakdowns" } }),
          text: async () => "",
        };
      }
      return fakeFetch([["/me/insights", { data: [{ name: "reach", total_value: { value: 3340 } }] }]])(url);
    }) as unknown as typeof fetch,
  });

  const result = await client.getAccountInsights!(RANGE);

  expect(result.metrics.reach).toBe(3340);
  expect(result.metrics.reach_follower).toBeUndefined();
  expect(result.unavailableMetrics).toContain("reach_follow_type");
  warn.mockRestore();
});
