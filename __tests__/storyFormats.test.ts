import {
  STORY_FORMATS,
  STORY_FORMAT_IDS,
  getStoryFormat,
  requiredBeats,
  formatCatalogForPrompt,
} from "@/lib/analysis/storyFormats";

test("문서의 10개 포맷을 모두 담는다", () => {
  expect(STORY_FORMAT_IDS).toHaveLength(10);
  expect(STORY_FORMAT_IDS).toContain("heros-journey");
  expect(STORY_FORMAT_IDS).toContain("lesson-from-others");
});

test("포맷마다 비트 시퀀스와 시크릿 소스를 갖는다", () => {
  for (const format of STORY_FORMATS) {
    expect(format.beats.length).toBeGreaterThanOrEqual(4);
    expect(format.secretSauce.length).toBeGreaterThan(0);
    expect(format.label.length).toBeGreaterThan(0);
  }
});

test("비트 id는 포맷 안에서 겹치지 않는다", () => {
  for (const format of STORY_FORMATS) {
    const ids = format.beats.map((beat) => beat.id);
    expect(new Set(ids).size).toBe(ids.length);
  }
});

test("모든 비트에 바로 쓸 수 있는 템플릿 문장이 붙는다", () => {
  for (const format of STORY_FORMATS) {
    for (const beat of format.beats) {
      expect(beat.templates.length).toBeGreaterThan(0);
    }
  }
});

test("id로 포맷을 찾고, 모르는 id는 null을 준다", () => {
  expect(getStoryFormat("challenge")?.label).toContain("챌린지");
  expect(getStoryFormat("nope")).toBeNull();
});

test("필수 비트만 추려낸다", () => {
  const win = getStoryFormat("win");
  expect(win).not.toBeNull();
  const required = requiredBeats(win!);

  // Win 포맷의 acknowledgment·CTA는 문서에서 optional로 표시돼 있다.
  expect(required.every((beat) => !beat.optional)).toBe(true);
  expect(required.length).toBeLessThan(win!.beats.length);
});

test("프롬프트용 카탈로그는 모든 포맷 id와 비트 id를 문자열로 노출한다", () => {
  const text = formatCatalogForPrompt();

  for (const id of STORY_FORMAT_IDS) {
    expect(text).toContain(id);
  }
  // 모델이 비트 id를 지어내지 않도록 후보를 그대로 실어 준다.
  expect(text).toContain("inflection-point");
  expect(text).toContain("before-state");
});
