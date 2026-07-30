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

// follows_and_unfollows는 breakdown=follow_type 없이 요청하면 total_value 자체가 없는
// 껍데기를 돌려준다. 그래서 계정 지표 묶음에 섞어 보내면 영구히 "미지원"으로 잡힌다.
// reach와 같은 breakdown 축이라 한 호출에 함께 실어 호출 수를 늘리지 않는다.
test("getAccountInsights는 팔로우/언팔로우를 follow_type breakdown에서 가져온다", async () => {
  const seen: string[] = [];
  const combined = {
    data: [
      breakdownResponse(226, 3654).data[0],
      {
        name: "follows_and_unfollows",
        total_value: {
          breakdowns: [
            {
              dimension_keys: ["follow_type"],
              results: [
                { dimension_values: ["FOLLOWER"], value: 27 },
                { dimension_values: ["NON_FOLLOWER"], value: 4 },
              ],
            },
          ],
        },
      },
    ],
  };
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: (async (url: string) => {
      seen.push(url);
      return fakeFetch([
        ["breakdown=follow_type", combined],
        ["/me/insights", { data: [{ name: "reach", total_value: { value: 3887 } }] }],
      ])(url);
    }) as unknown as typeof fetch,
  });

  const result = await client.getAccountInsights!(RANGE);

  expect(result.metrics.follows).toBe(27);
  expect(result.metrics.unfollows).toBe(4);
  expect(result.availableMetrics).toContain("follows_and_unfollows");
  // 정식 reach(중복 제거)는 breakdown 합(3880)이 아니라 base 값을 쓴다
  expect(result.metrics.reach).toBe(3887);
  // breakdown 축이 같으므로 호출은 하나로 끝나야 한다
  expect(seen.filter((url) => url.includes("breakdown=follow_type"))).toHaveLength(1);
});

test("getAccountInsights는 profile_views를 계정 지표로 요청한다", async () => {
  const seen: string[] = [];
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: (async (url: string) => {
      seen.push(url);
      return fakeFetch([
        ["breakdown=follow_type", breakdownResponse(226, 3654)],
        ["/me/insights", { data: [{ name: "profile_views", total_value: { value: 466 } }] }],
      ])(url);
    }) as unknown as typeof fetch,
  });

  const result = await client.getAccountInsights!(RANGE);

  expect(result.metrics.profile_views).toBe(466);
  const baseCall = seen.find((url) => !url.includes("breakdown=follow_type"));
  expect(decodeURIComponent(baseCall ?? "")).toContain("profile_views");
});

test("breakdown 요청이 실패해도 나머지 계정 지표는 살아남는다", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
