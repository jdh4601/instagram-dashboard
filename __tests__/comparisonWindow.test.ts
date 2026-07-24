import type { AccountSnapshot } from "@/lib/schemas";
import {
  COMPARISON_WINDOW_DAYS,
  findComparisonSnapshot,
} from "@/lib/analysis/comparisonWindow";
import { buildAccountOverview } from "@/lib/analysis/accountOverview";
import { buildAccountInsights } from "@/lib/analysis/accountInsights";

// 스크린샷에서 보고된 모순을 그대로 재현하는 데이터.
// 상단 카드는 2일 전(07-22)과 비교해 +2.1%, 인사이트는 7일 전(07-17)과 비교해 -13.3%를
// 동시에 보고했다. 7일 롤링 지표를 2일 전 값과 비교하면 창이 5/7 겹쳐 의미가 없다.
const CONTRADICTION: AccountSnapshot[] = [
  { date: "2026-07-17", followerCount: 270, reachLast7d: 4292, availableMetrics: ["reach"] },
  { date: "2026-07-22", followerCount: 279, reachLast7d: 3642, availableMetrics: ["reach"] },
  { date: "2026-07-24", followerCount: 280, reachLast7d: 3720, availableMetrics: ["reach"] },
];

describe("findComparisonSnapshot", () => {
  test("기준일보다 7일 이상 앞선 스냅샷 중 가장 최근 것을 고른다", () => {
    const snapshots: AccountSnapshot[] = [
      { date: "2026-07-01", followerCount: 200, reachLast7d: 1000 },
      { date: "2026-07-10", followerCount: 220, reachLast7d: 2000 },
      { date: "2026-07-16", followerCount: 240, reachLast7d: 3000 },
      { date: "2026-07-24", followerCount: 260, reachLast7d: 4000 },
    ];
    const current = snapshots[3];

    // 07-16은 8일 전이라 채택, 07-10(14일 전)보다 최근이므로 우선한다.
    expect(findComparisonSnapshot(snapshots, current)?.date).toBe("2026-07-16");
  });

  test("정확히 7일 떨어진 스냅샷은 채택한다", () => {
    const snapshots: AccountSnapshot[] = [
      { date: "2026-07-17", followerCount: 240, reachLast7d: 3000 },
      { date: "2026-07-24", followerCount: 260, reachLast7d: 4000 },
    ];
    expect(findComparisonSnapshot(snapshots, snapshots[1])?.date).toBe("2026-07-17");
  });

  test("7일 이상 앞선 스냅샷이 없으면 null을 준다", () => {
    const snapshots: AccountSnapshot[] = [
      { date: "2026-07-22", followerCount: 250, reachLast7d: 3000 },
      { date: "2026-07-24", followerCount: 260, reachLast7d: 4000 },
    ];
    expect(findComparisonSnapshot(snapshots, snapshots[1])).toBeNull();
  });

  test("기준일보다 나중인 스냅샷은 비교 대상이 아니다", () => {
    const snapshots: AccountSnapshot[] = [
      { date: "2026-07-10", followerCount: 220, reachLast7d: 2000 },
      { date: "2026-07-24", followerCount: 260, reachLast7d: 4000 },
    ];
    // 07-10 기준으로 07-24는 14일 떨어져 있지만 미래라 채택하면 안 된다.
    expect(findComparisonSnapshot(snapshots, snapshots[0])).toBeNull();
  });

  test("비교 창은 7일이다", () => {
    expect(COMPARISON_WINDOW_DAYS).toBe(7);
  });
});

describe("도달 비교 기준 통일 (INS-1)", () => {
  test("상단 개요와 계정 인사이트가 같은 기준점을 쓴다", () => {
    const overview = buildAccountOverview([], CONTRADICTION, null);
    const insights = buildAccountInsights(CONTRADICTION);
    const trend = insights.find((insight) => insight.id === "reach-trend");

    expect(trend).toBeDefined();
    // 두 모듈 모두 07-17(4,292)을 기준으로 삼아야 한다.
    expect(overview.deltas.reachLast7d?.absolute).toBe(3720 - 4292);
    expect(trend?.benchmarkValue).toBe(4292);
  });

  test("상단 개요와 계정 인사이트의 증감 부호가 일치한다", () => {
    const overview = buildAccountOverview([], CONTRADICTION, null);
    const trend = buildAccountInsights(CONTRADICTION).find((i) => i.id === "reach-trend");

    const overviewIncreased = (overview.deltas.reachLast7d?.absolute ?? 0) > 0;
    const insightIncreased = trend?.tone === "strength";

    expect(overviewIncreased).toBe(insightIncreased);
    expect(overviewIncreased).toBe(false); // 실제로는 감소한 주다
  });

  test("7일 전 스냅샷이 없으면 델타를 만들지 않는다", () => {
    const tooClose: AccountSnapshot[] = [
      { date: "2026-07-22", followerCount: 279, reachLast7d: 3642, availableMetrics: ["reach"] },
      { date: "2026-07-24", followerCount: 280, reachLast7d: 3720, availableMetrics: ["reach"] },
    ];
    const overview = buildAccountOverview([], tooClose, null);

    // 기준점이 없으면 아무 스냅샷이나 집어오지 않고 비교를 포기한다.
    expect(overview.deltas.reachLast7d).toBeNull();
    expect(overview.deltas.followers).toBeNull();
    expect(buildAccountInsights(tooClose).some((i) => i.id === "reach-trend")).toBe(false);
  });
});
