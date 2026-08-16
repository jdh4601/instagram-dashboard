import {
  buildAdEfficiency,
  filterAdEfficiency,
  hasMixedResultTypes,
  type AdEfficiencySort,
} from "@/lib/analysis/adEfficiency";
import { adSpendToPerformance } from "@/lib/ads/adSpend";
import type { AdSpend, Reel } from "@/lib/schemas";

function spend(over: Partial<AdSpend> = {}): AdSpend {
  return {
    mediaId: "a",
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

/** 캐러셀 1건(프로필 방문) + 릴스 2건(링크 클릭) */
function fixture(sort: AdEfficiencySort = "spend") {
  const perf = adSpendToPerformance([
    spend({ mediaId: "c1", resultType: "PROFILE_VISIT", spend: 4212, reach: 720, resultCount: 78 }),
    spend({ mediaId: "r1", resultType: "LINK_CLICK", spend: 21130, reach: 2196, resultCount: 170 }),
    spend({ mediaId: "r2", resultType: "LINK_CLICK", spend: 4454, reach: 439, resultCount: 13 }),
  ]);
  const reels = [
    reel("c1"),
    reel("r1", { mediaType: "REELS" }),
    reel("r2", { mediaType: "REELS" }),
  ];
  return buildAdEfficiency(perf, reels, sort);
}

test("결과율은 광고 도달 100명당 결과 수다", () => {
  const rows = fixture();
  const r1 = rows.find((r) => r.mediaId === "r1")!;

  expect(r1.resultRate).toBeCloseTo(7.74, 2); // 170/2196
  expect(rows.find((r) => r.mediaId === "r2")!.resultRate).toBeCloseTo(2.96, 2); // 13/439
});

test("형식으로 거른다", () => {
  const rows = fixture();

  expect(filterAdEfficiency(rows, { mediaType: "REELS" }).map((r) => r.mediaId)).toEqual([
    "r1",
    "r2",
  ]);
  expect(filterAdEfficiency(rows, { mediaType: "CAROUSEL" }).map((r) => r.mediaId)).toEqual(["c1"]);
  expect(filterAdEfficiency(rows, {})).toHaveLength(3);
});

test("결과 유형으로 거른다", () => {
  const rows = fixture();

  expect(filterAdEfficiency(rows, { resultType: "LINK_CLICK" })).toHaveLength(2);
  expect(
    filterAdEfficiency(rows, { resultType: "PROFILE_VISIT" }).map((r) => r.mediaId),
  ).toEqual(["c1"]);
});

test("형식과 결과 유형을 함께 거른다", () => {
  const rows = fixture();

  expect(filterAdEfficiency(rows, { mediaType: "REELS", resultType: "PROFILE_VISIT" })).toEqual([]);
  expect(
    filterAdEfficiency(rows, { mediaType: "REELS", resultType: "LINK_CLICK" }),
  ).toHaveLength(2);
});

test("지출·도달·CPM·결과단가·결과율로 재정렬한다", () => {
  expect(fixture("spend").map((r) => r.mediaId)).toEqual(["r1", "r2", "c1"]);
  expect(fixture("adReach").map((r) => r.mediaId)).toEqual(["r1", "c1", "r2"]);
  // 비용은 싼 쪽이 위
  expect(fixture("costPerResult").map((r) => r.mediaId)).toEqual(["c1", "r1", "r2"]);
  // 반응은 높은 쪽이 위
  expect(fixture("resultRate").map((r) => r.mediaId)).toEqual(["c1", "r1", "r2"]);
  // CPM은 싼 쪽이 위: c1 5549, r1 9622, r2 10145
  expect(fixture("cpm")[0].mediaId).toBe("c1");
});

// 프로필 방문 ₩54와 링크 클릭 ₩124를 한 줄에 세우면 "프로필 방문이 2배 효율적"으로
// 읽히지만, 사실은 더 싼 행동을 산 것뿐이다. 화면이 이 사실을 말해 줘야 한다.
test("결과 유형이 섞였는지 알려준다", () => {
  const rows = fixture();

  expect(hasMixedResultTypes(rows)).toBe(true);
  expect(hasMixedResultTypes(filterAdEfficiency(rows, { resultType: "LINK_CLICK" }))).toBe(false);
  expect(hasMixedResultTypes([])).toBe(false);
});
