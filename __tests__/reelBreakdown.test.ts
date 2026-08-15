import { buildBreakdownPrompt, parseBreakdownAnalysis } from "@/lib/reelBreakdown/analysis";
import {
  __private__,
  normalizeInstagramReelUrl,
  parseInstagramEmbedVideoUrl,
  parseSceneCuts,
} from "@/lib/reelBreakdown/pipeline";
import { reelBreakdownAssetPath } from "@/lib/reelBreakdown/files";
import type { Hook } from "@/lib/schemas";

const hook: Hook = {
  id: "h1",
  text: "다들 이렇게 생각하지만 아닙니다",
  category: "contrarian",
  sourceUrl: "https://www.instagram.com/reel/ABC_123/?igsh=test",
  isFavorite: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

test("Instagram 링크는 쿼리를 버리고 yt-dlp용 permalink로 만든다", () => {
  expect(normalizeInstagramReelUrl(hook.sourceUrl!)).toBe(
    "https://www.instagram.com/reel/ABC_123/",
  );
  expect(() => normalizeInstagramReelUrl("https://example.com/reel/ABC")).toThrow(/Instagram/);
});

test("ffmpeg showinfo에서 컷 시각을 0.1초로 읽는다", () => {
  expect(parseSceneCuts("showinfo pts_time:3.04 x\nshowinfo pts_time:12.88 y")).toEqual([
    3,
    12.9,
  ]);
});

test("embed HTML의 이중 이스케이프된 Instagram CDN 영상 주소를 복원한다", () => {
  const html = String.raw`foo \"video_url\":\"https:\\\/\\\/scontent-icn2-1.cdninstagram.com\\\/v\\\/reel.mp4?x=1&y=2\" bar`;

  expect(parseInstagramEmbedVideoUrl(html)).toBe(
    "https://scontent-icn2-1.cdninstagram.com/v/reel.mp4?x=1&y=2",
  );
  expect(() =>
    parseInstagramEmbedVideoUrl(
      String.raw`\"video_url\":\"https:\\\/\\\/example.com\\\/bad.mp4\"`,
    ),
  ).toThrow(/CDN/);
});

test("포스터 프레임은 외부 스킬과 같은 2초 간격 규칙을 쓴다", () => {
  expect(__private__.frameNumberAt(0)).toBe("0001.jpg");
  expect(__private__.frameNumberAt(4.1)).toBe("0003.jpg");
});

test("프롬프트는 사용자가 붙인 분류와 16개 taxonomy를 함께 준다", () => {
  const prompt = buildBreakdownPrompt(
    hook,
    [{ startSec: 0, endSec: 2, text: "첫 문장" }],
    10,
    [2.1],
  );

  expect(prompt.userText).toContain("역발상");
  expect(prompt.userText).toContain("negation: 부정 선언형");
  expect(prompt.userText).toContain("confession: 자기고백형");
});

function response(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    hookType: "negation",
    beats: Array.from({ length: 5 }, (_, index) => ({
      start: index * 2,
      end: (index + 1) * 2,
      label: index === 0 ? "훅" : `구간 ${index + 1}`,
      scene: "화자가 정면을 본다",
      original: "Original line",
      translation: "번역 대사",
    })),
    ...overrides,
  });
}

test("5~9개 비트의 완결된 JSON을 파싱한다", () => {
  const parsed = parseBreakdownAnalysis(`설명\n${response()}\n끝`, 10);

  expect(parsed.hookType).toBe("negation");
  expect(parsed.beats).toHaveLength(5);
});

test("겹치거나 영상 끝을 덮지 않는 비트를 거절한다", () => {
  const overlapping = JSON.parse(response());
  overlapping.beats[1].start = 1;
  expect(() => parseBreakdownAnalysis(JSON.stringify(overlapping), 10)).toThrow(/겹칩니다/);

  expect(() => parseBreakdownAnalysis(response(), 15)).toThrow(/영상 끝/);
});

test("asset 경로는 정해진 프레임·클립 이름만 허용한다", () => {
  expect(reelBreakdownAssetPath("/tmp/data", "safe-key", "clips/01.mp4")).toBe(
    "/tmp/data/reel-breakdowns/safe-key/clips/01.mp4",
  );
  expect(() => reelBreakdownAssetPath("/tmp/data", "safe-key", "../../secret")).toThrow(
    /허용되지 않은/,
  );
});
