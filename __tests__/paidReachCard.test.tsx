import { renderToStaticMarkup } from "react-dom/server";
import { PaidReachCard } from "@/components/PaidReachCard";
import { buildPaidMix } from "@/lib/analysis/paidMix";
import type { AccountSnapshot } from "@/lib/schemas";

// 실측값(2026-08-15 기준 최근 7일)을 그대로 쓴다.
const snapshot: AccountSnapshot = {
  date: "2026-08-15",
  followerCount: 1000,
  reachLast7d: 8889,
  paidReachLast7d: 1229,
  organicReachLast7d: 7660,
  paidViewsLast7d: 276,
  organicViewsLast7d: 12843,
  paidInteractionsLast7d: 66,
  organicInteractionsLast7d: 554,
};

test("광고 카드는 절대량 대신 도달 대비 반응률을 견준다", () => {
  const html = renderToStaticMarkup(<PaidReachCard mix={buildPaidMix([snapshot])} />);

  // 66/1229 = 5.37%, 554/7660 = 7.23%
  expect(html).toContain("5.37%");
  expect(html).toContain("7.23%");
  expect(html).toContain("0.74배");
  // 오가닉 절대량(7,660)을 광고와 나란히 세우지 않는다 — 볼 것이 없는 비교다
  expect(html).not.toContain("7,660");
  expect(html).not.toContain("12,843");
});

test("반응률 차이를 사람이 읽는 말로 옮긴다", () => {
  const html = renderToStaticMarkup(<PaidReachCard mix={buildPaidMix([snapshot])} />);

  expect(html).toContain("26% 덜 반응");
});

test("광고가 오가닉보다 잘 반응하면 그렇게 말한다", () => {
  const mix = buildPaidMix([{ ...snapshot, paidInteractionsLast7d: 200 }]);

  expect(mix!.efficiency!.ratio).toBeGreaterThan(1);
  expect(renderToStaticMarkup(<PaidReachCard mix={mix} />)).toContain("산 도달이 더 반응함");
});

test("스냅샷에 breakdown이 없으면 카드를 그리지 않는다", () => {
  expect(renderToStaticMarkup(<PaidReachCard mix={null} />)).toBe("");
});

test("광고 집행이 없던 기간에는 반응률 대신 집행 없음을 말한다", () => {
  const mix = buildPaidMix([
    { ...snapshot, paidReachLast7d: 0, paidViewsLast7d: 0, paidInteractionsLast7d: 0 },
  ]);
  const html = renderToStaticMarkup(<PaidReachCard mix={mix} />);

  expect(mix!.efficiency).toBeUndefined();
  expect(html).toContain("광고 집행 없음");
});
