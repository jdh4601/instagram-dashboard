import { buildAdEfficiency, sumAdEfficiency } from "@/lib/analysis/adEfficiency";
import type { AdPerformance } from "@/lib/ads/map";
import type { Reel } from "@/lib/schemas";

function perf(mediaId: string, over: Partial<AdPerformance> = {}): AdPerformance {
  return {
    mediaId,
    adCount: 1,
    spend: 30000,
    reach: 8000,
    impressions: 12000,
    clicks: 150,
    actions: { likes: 120, comments: 8, shares: 14, saves: 40, linkClicks: 22, totalEngagement: 204 },
    ...over,
  };
}

function reel(id: string, over: Partial<Reel> = {}): Reel {
  return {
    id,
    mediaType: "CAROUSEL",
    postedAt: "2026-08-01T00:00:00Z",
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

test("광고 성과와 오가닉 지표를 같은 줄에 놓고 단가를 계산한다", () => {
  const [row] = buildAdEfficiency([perf("111")], [reel("111")]);

  expect(row.spend).toBe(30000);
  // CPM 분모는 노출이다 — 광고끼리 합산한 도달에는 중복이 섞인다
  expect(row.cpm).toBe(2500);
  expect(row.costPerReach).toBe(3.75);
  // 좋아요120 + 댓글8 + 공유14 + 저장40 = 182
  expect(row.adEngagements).toBe(182);
  expect(row.costPerEngagement).toBeCloseTo(164.84, 1);
  // 182/8000 = 2.275%
  expect(row.adEngagementRate).toBeCloseTo(2.275, 3);
  // 오가닉 (100+3+143+40)/4000 = 7.15%
  expect(row.organicEngagements).toBe(286);
  expect(row.organicEngagementRate).toBeCloseTo(7.15, 2);
  expect(row.efficiencyRatio).toBeCloseTo(0.318, 2);
});

test("저장된 게시물에 없는 광고는 비교할 상대가 없어 버린다", () => {
  const rows = buildAdEfficiency([perf("111"), perf("없는게시물")], [reel("111")]);

  expect(rows).toHaveLength(1);
  expect(rows[0].mediaId).toBe("111");
});

test("참여가 0이면 참여 단가를 만들어내지 않고 null로 둔다", () => {
  const [row] = buildAdEfficiency(
    [perf("111", { actions: { likes: 0, comments: 0, shares: 0, saves: 0, linkClicks: 0, totalEngagement: 0 } })],
    [reel("111")],
  );

  expect(row.adEngagements).toBe(0);
  // 참여가 0이면 나눌 수 없다
  expect(row.costPerEngagement).toBeNull();
  // 반응률 0은 "계산 불가"가 아니라 "한 명도 반응하지 않았다"는 사실이다
  expect(row.adEngagementRate).toBe(0);
  expect(row.efficiencyRatio).toBe(0);
});

test("아직 안 도는 광고는 노출 0이라 CPM을 만들 수 없다", () => {
  const [row] = buildAdEfficiency(
    [perf("111", { spend: 0, reach: 0, impressions: 0 })],
    [reel("111")],
  );

  expect(row.cpm).toBeNull();
  expect(row.costPerReach).toBeNull();
  expect(row.adEngagementRate).toBeNull();
});

test("지출 순으로 정렬한다", () => {
  const rows = buildAdEfficiency(
    [perf("a", { spend: 10000 }), perf("b", { spend: 90000 })],
    [reel("a"), reel("b")],
    "spend",
  );

  expect(rows.map((r) => r.mediaId)).toEqual(["b", "a"]);
});

test("참여 단가는 쌀수록 위에 온다 — 비용은 낮은 쪽이 좋다", () => {
  const rows = buildAdEfficiency(
    [
      perf("비쌈", { spend: 90000 }),
      perf("쌈", { spend: 9000 }),
    ],
    [reel("비쌈"), reel("쌈")],
    "costPerEngagement",
  );

  expect(rows.map((r) => r.mediaId)).toEqual(["쌈", "비쌈"]);
});

test("계산 불가(null)는 어느 정렬에서도 뒤로 민다", () => {
  const rows = buildAdEfficiency(
    [
      perf("무참여", { actions: { likes: 0, comments: 0, shares: 0, saves: 0, linkClicks: 0, totalEngagement: 0 } }),
      perf("정상"),
    ],
    [reel("무참여"), reel("정상")],
    "costPerEngagement",
  );

  expect(rows.map((r) => r.mediaId)).toEqual(["정상", "무참여"]);
});

// 비율의 평균은 틀린다. 지출 9만/참여 2건과 지출 1천/참여 100건의 "평균 단가"는
// 두 단가를 더해 2로 나눈 값이 아니다.
test("합계는 비율을 평균내지 않고 합에서 다시 나눈다", () => {
  const rows = buildAdEfficiency(
    [
      perf("a", { spend: 90000, impressions: 10000, actions: { likes: 2, comments: 0, shares: 0, saves: 0, linkClicks: 0, totalEngagement: 2 } }),
      perf("b", { spend: 1000, impressions: 90000, actions: { likes: 100, comments: 0, shares: 0, saves: 0, linkClicks: 0, totalEngagement: 100 } }),
    ],
    [reel("a"), reel("b")],
  );
  const totals = sumAdEfficiency(rows);

  expect(totals.spend).toBe(91000);
  expect(totals.postCount).toBe(2);
  expect(totals.adEngagements).toBe(102);
  expect(totals.costPerEngagement).toBeCloseTo(892.16, 1);
  expect(totals.cpm).toBeCloseTo(910, 1);
});
