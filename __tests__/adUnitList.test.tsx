import { renderToStaticMarkup } from "react-dom/server";
import { AdUnitList } from "@/components/AdUnitList";
import type { AdUnit } from "@/lib/ads/adUnit";

function unit(over: Partial<AdUnit> = {}): AdUnit {
  return {
    adId: "120253915877380651",
    name: 'Post: "Ep 4. 매주 하나 만들고, 한 명에게 보여주기"',
    status: "ACTIVE",
    createdAt: "2026-08-30T10:21:23+0900",
    thumbnailUrl: "https://cdninstagram.example/reel-frame.jpg",
    spend: 3427,
    impressions: 698,
    reach: 600,
    clicks: 85,
    goal: "THRUPLAY",
    results: { count: 305, type: "THRUPLAY" },
    costPerResult: 11.23,
    budget: { amount: 4129, kind: "LIFETIME" },
    activity: [],
    engagements: 48,
    hasDelivery: true,
    ...over,
  };
}

test("광고 한 건이 한 줄이고 행은 그 광고의 상세로 간다", () => {
  const html = renderToStaticMarkup(<AdUnitList units={[unit()]} />);

  expect(html).toContain("Ep 4.");
  expect(html).toContain('href="/ads/120253915877380651"');
  expect(html).toContain("698"); // 조회(노출)
  expect(html).toContain("600"); // 조회자(도달)
  expect(html).toContain("305"); // 결과
});

// 오늘 실측한 상태다. 지표를 0으로 그리면 "돌았는데 아무도 안 봤다"로 읽힌다.
test("아직 안 도는 광고는 지표를 0이 아니라 빈 칸으로 둔다", () => {
  const html = renderToStaticMarkup(
    <AdUnitList
      units={[
        unit({
          status: "PENDING_REVIEW",
          hasDelivery: false,
          spend: 0,
          impressions: 0,
          reach: 0,
          results: null,
          costPerResult: null,
        }),
      ]}
    />,
  );

  expect(html).toContain("심사 중");
  expect(html).toContain("—");
  expect(html).not.toContain(">0<");
});

test("목록이 비면 왜 비었는지 짚어 준다", () => {
  const html = renderToStaticMarkup(<AdUnitList units={[]} />);

  expect(html).toContain("광고가 없습니다");
});

test("결과는 목표와 함께 적는다", () => {
  const html = renderToStaticMarkup(<AdUnitList units={[unit()]} />);

  expect(html).toContain("동영상 조회");
});

test("행마다 그 릴스의 썸네일을 건다", () => {
  const html = renderToStaticMarkup(<AdUnitList units={[unit()]} />);

  expect(html).toContain("https://cdninstagram.example/reel-frame.jpg");
});

test("썸네일이 없으면 빈 자리를 대신 그린다", () => {
  const html = renderToStaticMarkup(<AdUnitList units={[unit({ thumbnailUrl: undefined })]} />);

  expect(html).not.toContain("<img");
});
