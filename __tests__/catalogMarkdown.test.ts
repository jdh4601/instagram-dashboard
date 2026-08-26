import {
  hookTypeToMarkdown,
  scriptPrincipleToMarkdown,
  storyFormatToMarkdown,
  beatHeading,
} from "@/lib/analysis/catalogMarkdown";
import { getHookTypeSpec } from "@/lib/analysis/hookCatalog";
import { SCRIPT_PRINCIPLES } from "@/lib/analysis/scriptPrinciples";
import { getStoryFormat } from "@/lib/analysis/storyFormats";

function hookType(id: string) {
  const spec = getHookTypeSpec(id);
  if (!spec) throw new Error(`없는 훅 유형: ${id}`);
  return spec;
}

function principle(id: string) {
  const spec = SCRIPT_PRINCIPLES.find((item) => item.id === id);
  if (!spec) throw new Error(`없는 원리: ${id}`);
  return spec;
}

function format(id: string) {
  const spec = getStoryFormat(id);
  if (!spec) throw new Error(`없는 포맷: ${id}`);
  return spec;
}

test("훅 유형 마크다운은 라벨·원리·사용 시점·템플릿·예시를 한 덩어리로 담는다", () => {
  const spec = hookType("contrarian");
  const md = hookTypeToMarkdown(spec);

  expect(md).toContain(`## ${spec.label}`);
  expect(md).toContain("원리");
  expect(md).toContain("언제 쓰는가");
  expect(md).toContain("템플릿 문장");
  expect(md).toContain("예시");
  for (const template of spec.templates) expect(md).toContain(`- ${template}`);
  for (const example of spec.examples) expect(md).toContain(`- ${example}`);
});

test("훅 유형 마크다운은 붙여넣었을 때 앞뒤 공백이 남지 않는다", () => {
  const md = hookTypeToMarkdown(hookType("problem"));

  expect(md).toBe(md.trim());
  expect(md).not.toContain("\n\n\n");
});

test("원리 마크다운은 정의·이유·실행 방법·나쁜 예/좋은 예를 담는다", () => {
  const spec = principle("curiosity-contrast");
  const md = scriptPrincipleToMarkdown(spec);

  expect(md).toContain(`## ${spec.label}`);
  expect(md).toContain(spec.summary);
  expect(md).toContain("정의");
  expect(md).toContain("왜 작동하는가");
  expect(md).toContain("실행 방법");
  expect(md).toContain(`나쁜 예: ${spec.badExample}`);
  expect(md).toContain(`좋은 예: ${spec.goodExample}`);
});

test("포맷 마크다운은 비트를 순서대로 번호 매겨 템플릿까지 붙인다", () => {
  const spec = format("heros-journey");
  const md = storyFormatToMarkdown(spec);

  expect(md).toContain(`## ${spec.label}`);
  expect(md).toContain(spec.description);
  for (const sauce of spec.secretSauce) expect(md).toContain(`- ${sauce}`);

  expect(md).toContain("1. **도입** — 주인공과 문제를 세운다");
  expect(md).toContain("6. **제안 (선택)** — 사업·서비스로 잇는 행동 유도");
  expect(md).toContain("[기간] 전, 저는 [겪던 문제]를 안고 있었습니다.");
});

test("선택 비트는 라벨에 (선택)이 이미 있으면 두 번 붙이지 않는다", () => {
  expect(beatHeading({ id: "cta", label: "제안 (선택)", purpose: "", optional: true, templates: [] })).toBe(
    "제안 (선택)",
  );
  expect(beatHeading({ id: "ctx", label: "맥락", purpose: "", optional: true, templates: [] })).toBe(
    "맥락 (선택)",
  );
  expect(beatHeading({ id: "hook", label: "훅", purpose: "", templates: [] })).toBe("훅");
});

test("모든 포맷이 빈 줄 하나 없이 직렬화된다", () => {
  for (const spec of ["before-after", "challenge", "lesson-from-others"].map(format)) {
    const md = storyFormatToMarkdown(spec);
    expect(md).toBe(md.trim());
    expect(md).not.toContain("\n\n\n");
    expect(md.length).toBeGreaterThan(100);
  }
});
