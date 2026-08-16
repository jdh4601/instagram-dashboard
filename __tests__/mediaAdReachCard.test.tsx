import { renderToStaticMarkup } from "react-dom/server";
import { MediaAdReachCard } from "@/components/MediaAdReachCard";
import { buildAdEfficiency } from "@/lib/analysis/adEfficiency";
import { adSpendToPerformance } from "@/lib/ads/adSpend";
import type { AdSpend, Reel } from "@/lib/schemas";

// data/ad-spend.json의 실측 한 줄(2026-06-19 부스트)을 그대로 쓴다.
const boost: AdSpend = {
  mediaId: "미디어-1",
  boostedAt: "2026-06-19",
  spend: 21130,
  views: 2650,
  reach: 2196,
  resultCount: 170,
  resultType: "LINK_CLICK",
  source: "AD_CENTER",
};

const reel: Reel = {
  id: "미디어-1",
  postedAt: "2026-06-18T00:00:00Z",
  mediaType: "REELS",
  durationSec: 30,
  views: 5000,
  reach: 4000,
  likes: 100,
  comments: 10,
  saves: 20,
  shares: 30,
  avgWatchTimeSec: 10,
};

function render(entries: AdSpend[]) {
  const row = buildAdEfficiency(adSpendToPerformance(entries), [reel])[0] ?? null;
  return renderToStaticMarkup(<MediaAdReachCard ad={row} />);
}

test("광고 도달과 오가닉 도달을 갈라서 보여 준다", () => {
  const html = render([boost]);

  expect(html).toContain("2,196");
  expect(html).toContain("4,000");
});

test("광고 도달의 비중은 두 도달의 합을 분모로 삼는다", () => {
  // 게시물 레벨 reach는 오가닉만 세므로 전체 도달은 4,000 + 2,196 = 6,196이다.
  // 2,196 / 6,196 = 35.44%. 게시물 reach(4,000)를 분모로 쓰면 54.9%가 되어
  // "광고가 절반 넘게 실어 날랐다"는 거짓이 된다.
  expect(render([boost])).toContain("35.4%");
});

test("지출과 도달 한 명당 비용을 함께 보여 준다", () => {
  const html = render([boost]);

  expect(html).toContain("21,130원");
  // 21,130 / 2,196 = 9.62원 → fmtWon이 원 단위로 반올림해 10원
  expect(html).toContain("10원");
});

test("결과는 목표 유형을 밝혀서 보여 준다", () => {
  const html = render([boost]);

  expect(html).toContain("링크 클릭");
  expect(html).toContain("170");
});

test("광고를 태우지 않은 게시물에는 카드를 그리지 않는다", () => {
  // 0원짜리 카드를 띄우면 "광고를 태웠는데 성과가 0"으로 읽힌다.
  expect(renderToStaticMarkup(<MediaAdReachCard ad={null} />)).toBe("");
});

test("여러 번 태운 게시물은 부스트 횟수를 밝힌다", () => {
  const html = render([boost, { ...boost, boostedAt: "2026-07-01" }]);

  expect(html).toContain("2회");
});

test("참여를 모르는 수동 기록은 참여 단가를 지어내지 않는다", () => {
  // Ad Center는 광고에 달린 좋아요·저장을 알려주지 않는다. 0으로 채우면
  // "광고에 아무도 반응하지 않았다"는 거짓 사실이 된다.
  const html = render([boost]);

  expect(html).not.toContain("참여 단가");
});
