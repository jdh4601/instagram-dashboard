import { renderToStaticMarkup } from "react-dom/server";
import { ReelList } from "@/components/ReelList";
import type { Reel } from "@/lib/schemas";

const reel: Reel = {
  id: "17900000000000000",
  caption: "호날두에게 N억 투자받은 스타트업",
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 1276,
  reach: 900,
  likes: 9,
  comments: 1,
  saves: 7,
  shares: 2,
  avgWatchTimeSec: 10,
};

test("탭이 곧 필터라 목록에는 미디어 토글을 그리지 않는다", () => {
  const html = renderToStaticMarkup(<ReelList reels={[reel]} filter="REELS" />);

  expect(html).not.toContain('aria-label="미디어 종류 필터"');
  expect(html).toContain("게시물 목록");
});

test("목록이 비어도 토글 대신 그 종류에 맞는 안내만 남는다", () => {
  const html = renderToStaticMarkup(<ReelList reels={[]} filter="CAROUSEL" />);

  expect(html).not.toContain('aria-label="미디어 종류 필터"');
  expect(html).toContain("캐러셀 게시물이 없습니다");
});

test("행은 그 게시물 종류의 상세로 간다", () => {
  const reelHtml = renderToStaticMarkup(<ReelList reels={[reel]} filter="REELS" />);
  expect(reelHtml).toContain('href="/reel/17900000000000000"');

  // 캐러셀 행이 /reel/:id로 가면 사이드바에서 릴스 탭이 켜진다.
  const carouselHtml = renderToStaticMarkup(
    <ReelList reels={[{ ...reel, mediaType: "CAROUSEL" }]} filter="CAROUSEL" />,
  );
  expect(carouselHtml).toContain('href="/carousel/17900000000000000"');
  expect(carouselHtml).not.toContain('href="/reel/17900000000000000"');
});

describe("캐러셀 행은 캐러셀의 자를 쓴다", () => {
  const carousel: Reel = { ...reel, mediaType: "CAROUSEL", reach: 900, views: 3060, saves: 18 };

  test("우측 지표가 저장율(도달)이다 — 조회수 분모 인게이지먼트가 아니다", () => {
    const html = renderToStaticMarkup(<ReelList reels={[carousel]} filter="CAROUSEL" />);

    expect(html).toContain("저장율");
    expect(html).toContain("2.00%"); // 저장 18 / 도달 900
    expect(html).not.toContain("인게이지먼트");
  });

  test("릴스 행은 인게이지먼트 그대로다", () => {
    const html = renderToStaticMarkup(<ReelList reels={[reel]} filter="REELS" />);

    expect(html).toContain("인게이지먼트");
  });

  test("캐러셀 목록에는 영상 정렬(훅순·48h 조회순)이 없다", () => {
    const html = renderToStaticMarkup(<ReelList reels={[carousel]} filter="CAROUSEL" />);

    expect(html).not.toContain("훅순");
    expect(html).not.toContain("48h 조회순");
    expect(html).toContain("저장율순");
    expect(html).toContain("공유율순");
  });

  test("캐러셀 행은 조회수 대신 도달을 보여 준다", () => {
    const html = renderToStaticMarkup(<ReelList reels={[carousel]} filter="CAROUSEL" />);

    expect(html).toContain("도달 900");
    expect(html).not.toContain("3,060");
  });
});

test("동기화 중에는 필터 문구보다 진행 안내가 앞선다", () => {
  const html = renderToStaticMarkup(<ReelList reels={[]} filter="CAROUSEL" syncing />);

  expect(html).toContain("동기화 중입니다");
});
