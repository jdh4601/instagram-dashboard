import { renderToStaticMarkup } from "react-dom/server";
import { AdEfficiencyTable } from "@/components/AdEfficiencyTable";
import { buildAdEfficiency, sumAdEfficiency } from "@/lib/analysis/adEfficiency";
import type { AdPerformance } from "@/lib/ads/map";
import type { Reel } from "@/lib/schemas";
import { NAV_ITEMS, isNavItemActive } from "@/lib/ui/navigation";

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
    caption: "첫 줄 캡션",
    ...over,
  };
}

function render(ads: AdPerformance[], reels: Reel[]) {
  const rows = buildAdEfficiency(ads, reels);
  return renderToStaticMarkup(
    <AdEfficiencyTable rows={rows} totals={sumAdEfficiency(rows)} sort="spend" onSort={() => {}} />,
  );
}

test("표는 지출·CPM·참여 단가와 오가닉 대비 배수를 한 줄에 놓는다", () => {
  const html = render([perf("111")], [reel("111")]);

  expect(html).toContain("30,000원");
  expect(html).toContain("2,500원"); // CPM
  expect(html).toContain("165원"); // 참여 단가 30000/182
  expect(html).toContain("0.32배"); // 광고 2.275% ÷ 오가닉 7.15%
  expect(html).toContain("첫 줄 캡션");
});

test("캐러셀 행은 캐러셀 상세로, 릴스 행은 릴스 상세로 간다", () => {
  const html = render(
    [perf("111"), perf("222")],
    [reel("111"), reel("222", { mediaType: "REELS" })],
  );

  expect(html).toContain('href="/carousel/111"');
  expect(html).toContain('href="/reel/222"');
});

// 0으로 채우면 "0원에 샀다"로 읽혀 판단을 망친다.
test("계산할 수 없는 칸은 0이 아니라 —로 비운다", () => {
  const html = render(
    [perf("111", { spend: 0, reach: 0, impressions: 0, actions: { likes: 0, comments: 0, shares: 0, saves: 0, linkClicks: 0, totalEngagement: 0 } })],
    [reel("111")],
  );

  expect(html).toContain("—");
  expect(html).not.toContain("0원에");
});

test("같은 게시물을 여러 번 태우면 광고 건수를 밝힌다", () => {
  const html = render([perf("111", { adCount: 3 })], [reel("111")]);

  expect(html).toContain("광고 3건");
});

test("합계 줄은 지출과 단가를 다시 계산해 얹는다", () => {
  const html = render(
    [perf("111", { spend: 10000 }), perf("222", { spend: 90000 })],
    [reel("111"), reel("222")],
  );

  expect(html).toContain("합계 · 2건");
  expect(html).toContain("100,000원");
});

test("광고 효율 탭이 사이드바에 있고 /ads에서 켜진다", () => {
  const item = NAV_ITEMS.find((nav) => nav.href === "/ads");

  expect(item?.label).toBe("광고 효율");
  expect(isNavItemActive("/ads", item!)).toBe(true);
  // 대시보드 탭이 함께 켜지면 화면과 사이드바가 어긋난다
  expect(isNavItemActive("/ads", NAV_ITEMS.find((nav) => nav.href === "/")!)).toBe(false);
});
