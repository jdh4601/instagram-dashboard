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

test("동기화 중에는 필터 문구보다 진행 안내가 앞선다", () => {
  const html = renderToStaticMarkup(<ReelList reels={[]} filter="CAROUSEL" syncing />);

  expect(html).toContain("동기화 중입니다");
});
