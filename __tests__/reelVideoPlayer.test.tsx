import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ReelVideoPlayer } from "@/components/ReelVideoPlayer";
import type { Reel } from "@/lib/schemas";

function reel(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "r1",
    postedAt: "2026-06-01T00:00:00Z",
    durationSec: 30,
    views: 100,
    reach: 90,
    likes: 3,
    comments: 1,
    saves: 2,
    shares: 1,
    avgWatchTimeSec: 12,
    ...overrides,
  };
}

function render(overrides: Partial<Reel> = {}): string {
  return renderToStaticMarkup(
    <ReelVideoPlayer reel={reel(overrides)} onDownloaded={() => undefined} />,
  );
}

test("세로 영상은 어느 폭에서도 16rem을 넘지 않는다", () => {
  // lg 미만에서는 그리드가 한 열로 접혀 영상이 본문 폭을 통째로 먹는다.
  // 9:16이라 폭이 커지면 높이가 그 1.8배로 뛰어 화면을 다 차지한다.
  expect(render()).toContain("max-w-[16rem]");
});

test("세로 비율을 유지한다", () => {
  expect(render()).toContain("aspect-[9/16]");
});

test("영상이 없으면 받기 버튼을 보여준다", () => {
  const html = render();

  expect(html).toContain("영상 받기");
});

test("영상이 있으면 받기 버튼을 감춘다", () => {
  const html = render({ videoFile: "r1.mp4" });

  expect(html).not.toContain("영상 받기");
  expect(html).toContain("<video");
});
