import { renderToStaticMarkup } from "react-dom/server";
import { SavedStoryFormatList } from "@/components/SavedStoryFormatList";
import type { SavedStoryFormat } from "@/lib/schemas";

function saved(id: string, overrides: Partial<SavedStoryFormat> = {}): SavedStoryFormat {
  return {
    id,
    story: {
      formatId: "heros-journey",
      confidence: "high",
      rationale: "문제 → 실패 → 해법 순서가 그대로 나타난다",
      beats: [
        { beatId: "intro", present: true, summary: "도입" },
        { beatId: "climax", present: false, summary: "해법 없음" },
      ],
      secretSauceMet: "본인의 통증을 먼저 꺼낸다",
      secretSauceMissed: "실패 과정이 없다",
    },
    source: {
      reelId: id,
      title: "3년간 안 팔리던 텀블러",
      postedAt: "2026-08-01T00:00:00Z",
      permalink: "https://www.instagram.com/reel/abc/",
      views: 12000,
    },
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    ...overrides,
  };
}

function render(items: SavedStoryFormat[]): string {
  return renderToStaticMarkup(
    <SavedStoryFormatList items={items} onDelete={async () => undefined} />,
  );
}

test("저장한 게 없으면 어디서 담는지 알려준다", () => {
  const html = render([]);
  expect(html).toContain("Storytelling Format");
});

test("항목마다 어떤 유형인지 배지로 보여주고 그 포맷 상세로 잇는다", () => {
  const html = render([saved("r1")]);

  expect(html).toContain("히어로즈 저니 (1인칭 문제 해결)");
  expect(html).toContain('href="/story-formats/heros-journey"');
  expect(html).toContain("확신 높음");
});

test("원본 릴스로 되돌아갈 수 있다", () => {
  const html = render([saved("r1")]);

  expect(html).toContain("3년간 안 팔리던 텀블러");
  expect(html).toContain('href="/reel/r1"');
  expect(html).toContain("https://www.instagram.com/reel/abc/");
});

test("판정 근거와 비트 충족 개수를 함께 남긴다", () => {
  const html = render([saved("r1")]);

  expect(html).toContain("문제 → 실패 → 해법 순서가 그대로 나타난다");
  // 두 비트 중 하나만 실제로 있었다.
  expect(html).toContain("비트 1/2");
});

test("최근에 담은 것이 위로 온다", () => {
  const html = render([
    saved("오래된", { createdAt: "2026-08-01T09:00:00.000Z" }),
    saved("최신", { createdAt: "2026-08-05T09:00:00.000Z" }),
  ]);

  expect(html.indexOf('href="/reel/최신"')).toBeLessThan(html.indexOf('href="/reel/오래된"'));
});
