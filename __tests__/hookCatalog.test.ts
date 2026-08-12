import { HOOK_TYPES, PRINCIPLE_IDS, PRINCIPLE_LABELS } from "@/lib/schemas/reelAnalysis";
import { HOOK_TYPE_CATALOG, getHookTypeSpec } from "@/lib/analysis/hookCatalog";
import { SCRIPT_PRINCIPLES, getScriptPrinciple } from "@/lib/analysis/scriptPrinciples";
import { STORY_FORMATS } from "@/lib/analysis/storyFormats";

// 카탈로그의 목적은 "빠짐없이 보여 주는 것"이다. 항목 하나가 비면 화면에 구멍이
// 나는 게 아니라 사용자가 그 유형을 아예 모르게 된다 — 완전성부터 못 박는다.
test("훅 유형 카탈로그는 분석 스키마의 7종을 그대로 덮는다", () => {
  expect(HOOK_TYPE_CATALOG.map((spec) => spec.id)).toEqual([...HOOK_TYPES]);
});

test("훅 유형마다 원리·사용 시점·템플릿·예시가 채워져 있다", () => {
  for (const spec of HOOK_TYPE_CATALOG) {
    expect(spec.label.length).toBeGreaterThan(0);
    expect(spec.principle.length).toBeGreaterThan(20);
    expect(spec.whenToUse.length).toBeGreaterThan(10);
    expect(spec.templates.length).toBeGreaterThanOrEqual(2);
    expect(spec.examples.length).toBeGreaterThanOrEqual(1);
  }
});

test("훅 템플릿의 빈칸은 대괄호로 판다", () => {
  // 대괄호가 없으면 갈아 끼울 자리를 못 찾는다. other는 정의상 유형이 없으므로 제외.
  for (const spec of HOOK_TYPE_CATALOG.filter((s) => s.id !== "other")) {
    for (const template of spec.templates) {
      expect(template).toMatch(/\[[^\]]+\]/);
    }
  }
});

test("훅 유형을 id로 찾고, 모르는 id는 null로 돌려준다", () => {
  expect(getHookTypeSpec("contrarian")?.label).toBe("역발상");
  expect(getHookTypeSpec("nope")).toBeNull();
});

test("스크립트 원리 카탈로그는 8종 id와 라벨을 그대로 쓴다", () => {
  expect(SCRIPT_PRINCIPLES.map((spec) => spec.id)).toEqual([...PRINCIPLE_IDS]);
  for (const spec of SCRIPT_PRINCIPLES) {
    expect(spec.label).toBe(PRINCIPLE_LABELS[spec.id]);
  }
});

test("원리마다 정의·작동 이유·실행 방법·나쁜 예/좋은 예가 있다", () => {
  for (const spec of SCRIPT_PRINCIPLES) {
    expect(spec.summary.length).toBeGreaterThan(5);
    expect(spec.definition.length).toBeGreaterThan(20);
    expect(spec.whyItWorks.length).toBeGreaterThan(20);
    expect(spec.howTo.length).toBeGreaterThanOrEqual(2);
    expect(spec.badExample.length).toBeGreaterThan(5);
    expect(spec.goodExample.length).toBeGreaterThan(5);
  }
});

test("원리를 id로 찾고, 모르는 id는 null로 돌려준다", () => {
  expect(getScriptPrinciple("rhythm")?.label).toBe("리듬과 완급");
  expect(getScriptPrinciple("nope")).toBeNull();
});

test("스토리텔링 포맷 10종은 기존 상수를 그대로 쓴다", () => {
  // 카탈로그는 새 데이터를 만들지 않는다. 개수가 어긋나면 어딘가에 복사본이 생긴 것이다.
  expect(STORY_FORMATS).toHaveLength(10);
});
