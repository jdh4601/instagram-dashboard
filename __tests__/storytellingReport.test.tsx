import { renderToStaticMarkup } from "react-dom/server";
import { StorytellingReport } from "@/components/StorytellingReport";
import { PRINCIPLE_IDS, type ReelStoryFormat, type PrincipleScore } from "@/lib/schemas";

const story: ReelStoryFormat = {
  formatId: "heros-journey",
  confidence: "medium",
  rationale: "문제와 통증은 있지만 해법 구간이 비어 있다",
  alternateFormatId: "personal-update",
  beats: [
    { beatId: "intro", present: true, startSec: 0, endSec: 2.5, summary: "문제 제기", quote: "이걸 안 합니다" },
    { beatId: "inflection-point", present: true, startSec: 2.5, endSec: 10, summary: "통증 서술" },
    { beatId: "rising-action", present: false, summary: "실패한 시도가 통째로 없어 문제가 가볍게 보인다" },
    { beatId: "climax", present: false, summary: "해법을 끝내 밝히지 않는다" },
    { beatId: "falling-action", present: false, summary: "결과 증명이 없다" },
    { beatId: "resolution", present: true, startSec: 30, endSec: 40, summary: "링크 안내" },
  ],
  secretSauceMet: "본인의 통증을 먼저 꺼내 공감을 만든다",
  secretSauceMissed: "실패 과정이 없어 해법의 무게가 실리지 않는다",
};

const principles: PrincipleScore[] = PRINCIPLE_IDS.map((id, index) => ({
  id,
  score: ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5,
  evidence: `${id} 근거 문장`,
  fix: `${id} 개선안`,
}));

function render(overrides: Partial<{ story: ReelStoryFormat; principles: PrincipleScore[] }> = {}) {
  return renderToStaticMarkup(
    <StorytellingReport story={overrides.story ?? story} principles={overrides.principles ?? principles} />,
  );
}

test("분류된 포맷을 한국어 이름과 확신도로 보여준다", () => {
  const html = render();

  expect(html).toContain("히어로즈 저니");
  expect(html).toContain("보통");
  expect(html).toContain("문제와 통증은 있지만");
  // 확신이 낮을 때 차선 후보를 함께 보여줘야 사용자가 판단할 수 있다.
  expect(html).toContain("근황 공유");
});

test("비트는 카탈로그의 한국어 이름으로 그린다", () => {
  const html = render();

  expect(html).toContain("실패한 시도");
  expect(html).toContain("해법 발견");
  expect(html).not.toContain("rising-action");
});

test("빠진 비트를 개수와 함께 짚는다", () => {
  const html = render();

  // 6개 중 3개가 빠졌다.
  expect(html).toContain("빠진 비트");
  expect(html).toContain("3");
  expect(html).toContain("실패한 시도가 통째로 없어");
});

test("빠진 비트에는 채워 넣을 템플릿 문장이 붙는다", () => {
  const html = render();

  // 카탈로그의 mad-lib 템플릿이 그대로 보여야 바로 쓸 수 있다.
  expect(html).toContain("[방법1]");
});

test("있는 비트에는 시각과 인용을 붙이고 템플릿은 붙이지 않는다", () => {
  const html = render();

  expect(html).toContain("0-2.5s");
  expect(html).toContain("이걸 안 합니다");
});

test("시크릿 소스는 지킨 것과 놓친 것을 나눠 보여준다", () => {
  const html = render();

  expect(html).toContain("본인의 통증을 먼저 꺼내");
  expect(html).toContain("실패 과정이 없어");
});

test("8가지 원리를 한국어 이름과 점수로 모두 보여준다", () => {
  const html = render();

  expect(html).toContain("호기심과 대비");
  expect(html).toContain("가치까지의 속도");
  expect(html).toContain("리듬과 완급");
  expect(html).toContain("근거 문장");
  expect(html).toContain("개선안");
});

test("점수는 보조기술에도 숫자로 읽힌다", () => {
  const html = render();

  expect(html).toContain('aria-label="5점 만점에 1점"');
});

test("모든 비트가 있으면 빠진 비트 구역을 만들지 않는다", () => {
  const complete: ReelStoryFormat = {
    ...story,
    beats: story.beats.map((beat) => ({ ...beat, present: true })),
  };

  expect(render({ story: complete })).not.toContain("빠진 비트");
});
