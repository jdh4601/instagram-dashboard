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

test("사진 옆 빈 공간을 퍼널과 지표 벤치마크가 채운다", () => {
  const html = render();

  // 둘 다 사진과 나란한 위쪽 구역에 있어야 한다 — 성과표보다 앞선다.
  expect(html.indexOf("프로필 전환 퍼널")).toBeLessThan(html.indexOf("캐러셀 성과"));
  expect(html.indexOf("지표 벤치마크")).toBeLessThan(html.indexOf("캐러셀 성과"));
});

test("릴스용 진단 카드는 캐러셀 상세에 그리지 않는다", () => {
  const html = render();

  expect(html).not.toContain("이번 병목");
  expect(html).not.toContain("잘되는 점");
  expect(html).not.toContain("당장 개선");
  expect(html).not.toContain("해결책");
  expect(html).not.toContain("핵심 인사이트");
  expect(html).not.toContain("조회수 추이");
  expect(html).not.toContain("파생 성과 지표");
});

test("사진 카드에는 제목을 얹지 않는다", () => {
  const html = render();

  // 목록 썸네일(w-10)과 달리 상세에서는 사진이 주인공이다. 사진 위에 설명을 붙이면
  // 그 자리만큼 사진이 줄어든다.
  expect(html).toContain("https://cdn/first-slide.jpg");
  expect(html).not.toContain("캐러셀 낱장");
});

test("썸네일이 없어도 화면이 무너지지 않는다", () => {
  const html = render({ ...carousel, thumbnailUrl: undefined });

  expect(html).toContain("캐러셀 성과");
});

test("프로필 지표가 없으면 퍼널만 빠지고 벤치마크는 남는다", () => {
  const html = render({ ...carousel, profileVisits: undefined, followsFromReel: undefined });

  expect(html).not.toContain("프로필 전환 퍼널");
  expect(html).toContain("지표 벤치마크");
  expect(html).toContain("캐러셀 성과");
});
