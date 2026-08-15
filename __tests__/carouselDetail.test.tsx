import { renderToStaticMarkup } from "react-dom/server";
import { CarouselDetail } from "@/components/CarouselDetail";
import { analyzeReel } from "@/lib/analysis/analyze";
import type { Reel } from "@/lib/schemas";

const carousel: Reel = {
  id: "17900000000000000",
  mediaType: "CAROUSEL",
  caption: "1년 동안 아무 일도 없었다",
  postedAt: "2026-07-17T00:00:00Z",
  durationSec: 0,
  views: 1662,
  reach: 475,
  likes: 15,
  comments: 3,
  saves: 5,
  shares: 10,
  avgWatchTimeSec: 0,
  totalInteractions: 36,
  profileVisits: 11,
  followsFromReel: 0,
  thumbnailUrl: "https://cdn/first-slide.jpg",
  permalink: "https://www.instagram.com/p/abc/",
};

function render(reel: Reel = carousel): string {
  return renderToStaticMarkup(<CarouselDetail reel={reel} analysis={analyzeReel(reel, [])} />);
}

test("캐러셀 상세는 성과와 프로필 전환 퍼널을 보여준다", () => {
  const html = render();

  expect(html).toContain("캐러셀 성과");
  expect(html).toContain("프로필 전환 퍼널");
});

test("프로필 전환 퍼널이 성과표보다 위에 온다", () => {
  const html = render();

  expect(html.indexOf("프로필 전환 퍼널")).toBeLessThan(html.indexOf("캐러셀 성과"));
});

test("릴스용 진단 카드는 캐러셀 상세에 그리지 않는다", () => {
  const html = render();

  expect(html).not.toContain("이번 병목");
  expect(html).not.toContain("잘되는 점");
  expect(html).not.toContain("당장 개선");
  expect(html).not.toContain("해결책");
  expect(html).not.toContain("핵심 인사이트");
  expect(html).not.toContain("조회수 추이");
});

test("첫 장을 크게 걸고 나머지는 낱장 조회로 채운다", () => {
  const html = render();

  // 목록 썸네일(w-10)과 달리 상세에서는 사진이 주인공이다.
  expect(html).toContain("https://cdn/first-slide.jpg");
  expect(html).toContain("캐러셀 낱장");
});

test("썸네일이 없어도 화면이 무너지지 않는다", () => {
  const html = render({ ...carousel, thumbnailUrl: undefined });

  expect(html).toContain("캐러셀 성과");
});

test("프로필 지표가 없으면 퍼널 자리를 비운다", () => {
  const html = render({ ...carousel, profileVisits: undefined, followsFromReel: undefined });

  expect(html).not.toContain("프로필 전환 퍼널");
  expect(html).toContain("캐러셀 성과");
});
