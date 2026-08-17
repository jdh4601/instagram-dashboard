import {
  alignBeatOriginals,
  buildBreakdownPrompt,
  parseBreakdownAnalysis,
} from "@/lib/reelBreakdown/analysis";
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

test("비트의 원문은 모델이 다시 쓴 문장이 아니라 자막 그대로를 쓴다", () => {
  const beats = [
    { start: 0, end: 3, original: "모델이 다듬은 문장", translation: "번역 A" },
    { start: 3, end: 6, original: "또 다듬은 문장", translation: "번역 B" },
  ];
  const lines = [
    { startSec: 0, endSec: 1.4, text: "Pre-order?" },
    { startSec: 1.5, endSec: 2.9, text: "Joining a waitlist?" },
    { startSec: 3.1, endSec: 5.8, text: "Give attention a clear next step." },
  ];

  const aligned = alignBeatOriginals(beats, lines);

  expect(aligned[0].original).toBe("Pre-order? Joining a waitlist?");
  expect(aligned[1].original).toBe("Give attention a clear next step.");
  // 번역은 모델이 쓴 그대로 둔다.
  expect(aligned[0].translation).toBe("번역 A");
});

test("구간 경계에 걸친 자막 줄은 더 많이 겹치는 쪽 한 곳에만 넣는다", () => {
  const beats = [
    { start: 0, end: 3, original: "x", translation: "번역 A" },
    { start: 3, end: 8, original: "y", translation: "번역 B" },
  ];
  const lines = [{ startSec: 2.5, endSec: 7, text: "경계를 넘는 한 문장" }];

  const aligned = alignBeatOriginals(beats, lines);

  expect(aligned[0].original).toBe("(대사 없음)");
  expect(aligned[1].original).toBe("경계를 넘는 한 문장");
});

test("어느 구간에도 겹치지 않는 자막 줄은 버리지 않고 가장 가까운 구간에 붙인다", () => {
  const beats = [
    { start: 0, end: 2, original: "x", translation: "번역 A" },
    { start: 3, end: 6, original: "y", translation: "번역 B" },
  ];
  const lines = [{ startSec: 2.2, endSec: 2.6, text: "빈틈에 떨어진 대사" }];

  const aligned = alignBeatOriginals(beats, lines);

  expect(aligned[0].original).toBe("빈틈에 떨어진 대사");
  expect(aligned[1].original).toBe("(대사 없음)");
});

test("대사가 없는 구간은 번역까지 비워 지어낸 대사가 남지 않게 한다", () => {
  const beats = [{ start: 0, end: 2, original: "지어낸 대사", translation: "지어낸 번역" }];

  const aligned = alignBeatOriginals(beats, []);

  expect(aligned[0].original).toBe("(대사 없음)");
  expect(aligned[0].translation).toBe("(대사 없음)");
});
