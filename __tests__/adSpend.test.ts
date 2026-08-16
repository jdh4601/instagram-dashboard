import { adSpendToPerformance } from "@/lib/ads/adSpend";
import { buildAdEfficiency, groupByResultType } from "@/lib/analysis/adEfficiency";
import type { AdSpend, Reel } from "@/lib/schemas";

function spend(over: Partial<AdSpend> = {}): AdSpend {
  return {
    mediaId: "18021852389697322",
    boostedAt: "2026-08-14",
    spend: 4212,
    views: 759,
    reach: 720,
    resultCount: 78,
    resultType: "PROFILE_VISIT",
    source: "AD_CENTER",
    ...over,
  };
}

function reel(id: string, over: Partial<Reel> = {}): Reel {
  return {
    id,
    mediaType: "CAROUSEL",
    postedAt: "2026-08-14T00:00:00Z",
    durationSec: 0,
    views: 6985,
    reach: 4000,
    likes: 100,
    comments: 3,
    saves: 143,
    shares: 40,
    avgWatchTimeSec: 0,
    caption: "본문",
    ...over,
  };
}

test("수동 기록을 광고 성과 모양으로 옮긴다", () => {
  const [perf] = adSpendToPerformance([spend()]);

  expect(perf.mediaId).toBe("18021852389697322");
  expect(perf.spend).toBe(4212);
  expect(perf.reach).toBe(720);
  expect(perf.impressions).toBe(759);
  expect(perf.results).toEqual({ count: 78, type: "PROFILE_VISIT" });
  // Ad Center는 광고에 달린 좋아요·저장을 알려주지 않는다. 0으로 채우면
  // "반응이 없었다"로 읽히므로 참여는 아예 비운다.
  expect(perf.actions).toBeUndefined();
});

test("같은 게시물을 여러 번 태우면 합치되 결과 유형이 다르면 가른다", () => {
  const rows = adSpendToPerformance([
    spend({ spend: 4212, resultCount: 78, resultType: "PROFILE_VISIT" }),
    spend({ spend: 3000, resultCount: 20, resultType: "PROFILE_VISIT" }),
    spend({ spend: 5000, resultCount: 40, resultType: "LINK_CLICK" }),
  ]);

  expect(rows).toHaveLength(2);
  const visits = rows.find((r) => r.results?.type === "PROFILE_VISIT")!;
  expect(visits.spend).toBe(7212);
  expect(visits.results!.count).toBe(98);
  expect(visits.adCount).toBe(2);
  expect(rows.find((r) => r.results?.type === "LINK_CLICK")!.spend).toBe(5000);
});

test("결과 단가와 CPM을 계산한다", () => {
  const perf = adSpendToPerformance([spend()]);
  const [row] = buildAdEfficiency(perf, [reel("18021852389697322")]);

  expect(row.costPerResult).toBeCloseTo(54.0, 1); // 4212/78
  expect(row.cpm).toBeCloseTo(5549.4, 0); // 4212/759*1000
  expect(row.costPerReach).toBeCloseTo(5.85, 2);
  expect(row.resultType).toBe("PROFILE_VISIT");
  // 광고 참여를 모르므로 참여 기반 값은 만들어내지 않는다
  expect(row.costPerEngagement).toBeNull();
  expect(row.efficiencyRatio).toBeNull();
  // 오가닉 반응률은 그대로 읽힌다 — 눈으로 견주라고 남긴다
  expect(row.organicEngagementRate).toBeCloseTo(7.15, 2);
});

test("결과 유형이 다른 행을 한 표에 섞지 않고 묶는다", () => {
  const perf = adSpendToPerformance([
    spend({ mediaId: "a", resultType: "PROFILE_VISIT", spend: 4212, resultCount: 78 }),
    spend({ mediaId: "b", resultType: "LINK_CLICK", spend: 21130, resultCount: 170 }),
    spend({ mediaId: "c", resultType: "LINK_CLICK", spend: 4454, resultCount: 13 }),
  ]);
  const rows = buildAdEfficiency(perf, [reel("a"), reel("b"), reel("c")]);
  const groups = groupByResultType(rows);

  // 묶음 순서는 정렬 결과를 따른다 — 기본 정렬(지출 내림차순)에서는 21,130원짜리
  // 링크 클릭 묶음이 먼저다. 사용자가 정렬한 결과를 묶기가 뒤집으면 안 된다.
  expect(groups.map((g) => g.type)).toEqual(["LINK_CLICK", "PROFILE_VISIT"]);
  expect(groups[0].rows).toHaveLength(2);
  expect(groups[1].rows).toHaveLength(1);
  expect(groups[0].rows.map((r) => r.mediaId)).toEqual(["b", "c"]);
  expect(groups[0].totals.costPerResult).toBeCloseTo(139.8, 1); // 25584/183
});

test("결과가 0이면 단가를 만들어내지 않는다", () => {
  const perf = adSpendToPerformance([spend({ resultCount: 0 })]);
  const [row] = buildAdEfficiency(perf, [reel("18021852389697322")]);

  expect(row.costPerResult).toBeNull();
});
