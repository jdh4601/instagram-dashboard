import { renderToStaticMarkup } from "react-dom/server";
import { PaidReachCard } from "@/components/PaidReachCard";
import { buildPaidMix } from "@/lib/analysis/paidMix";
import type { AccountSnapshot } from "@/lib/schemas";

const snapshot: AccountSnapshot = {
  date: "2026-08-14",
  followerCount: 1000,
  reachLast7d: 13922,
  paidReachLast7d: 2341,
  organicReachLast7d: 12887,
  paidViewsLast7d: 2225,
  organicViewsLast7d: 32598,
  paidInteractionsLast7d: 43,
  organicInteractionsLast7d: 1066,
};

test("광고 카드는 도달·조회수·상호작용의 광고분과 비중을 보여준다", () => {
  const html = renderToStaticMarkup(<PaidReachCard mix={buildPaidMix([snapshot])} />);

  expect(html).toContain("도달");
  expect(html).toContain("조회수");
  expect(html).toContain("상호작용");
  // 광고분 절대값 — "얼마를 사서 얻었나"
  expect(html).toContain("2,341");
  expect(html).toContain("2,225");
  // 비중 — "그게 전체의 몇 %인가"
  expect(html).toContain("15.37%");
});

test("스냅샷에 breakdown이 없으면 카드를 그리지 않는다", () => {
  const html = renderToStaticMarkup(<PaidReachCard mix={null} />);

  expect(html).toBe("");
});

test("광고 집행이 없던 기간에는 0 대신 집행 없음을 말한다", () => {
  const mix = buildPaidMix([{ ...snapshot, paidReachLast7d: 0, paidViewsLast7d: 0, paidInteractionsLast7d: 0 }]);
  const html = renderToStaticMarkup(<PaidReachCard mix={mix} />);

  expect(html).toContain("광고 집행 없음");
});
