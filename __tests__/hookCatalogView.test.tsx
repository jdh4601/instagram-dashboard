import { renderToStaticMarkup } from "react-dom/server";
import { HookCatalog } from "@/components/HookCatalog";
import { HOOK_TYPE_CATALOG } from "@/lib/analysis/hookCatalog";
import { SCRIPT_PRINCIPLES } from "@/lib/analysis/scriptPrinciples";
import { STORY_FORMATS } from "@/lib/analysis/storyFormats";
import type { HookExample } from "@/lib/ui/hookExamples";
import type { HookType } from "@/lib/schemas/reelAnalysis";

function render(examples: Partial<Record<HookType, HookExample[]>> = {}): string {
  return renderToStaticMarkup(<HookCatalog examples={examples} />);
}

test("카탈로그는 세 묶음의 제목을 모두 내건다", () => {
  const html = render();

  expect(html).toContain("훅 유형 카탈로그");
  expect(html).toContain("스크립트 원리");
  expect(html).toContain("스토리텔링 포맷");
});

test("훅 7유형·원리 8종·포맷 10종의 라벨이 모두 나온다", () => {
  const html = render();

  for (const spec of HOOK_TYPE_CATALOG) expect(html).toContain(spec.label);
  for (const spec of SCRIPT_PRINCIPLES) expect(html).toContain(spec.label);
  for (const format of STORY_FORMATS) expect(html).toContain(format.label);
});

test("접었다 펼치는 구조라 기본은 닫혀 있다", () => {
  const html = render();

  expect(html).toContain('aria-expanded="false"');
});

test("복사 버튼은 묶음 단위로만 붙는다", () => {
  const html = render();
  const copyButtons = html.match(/전체 복사/g) ?? [];

  // 훅 7 + 원리 8 + 포맷 10 = 25개. 문장 낱개 복사 버튼은 넣지 않는다.
  expect(copyButtons).toHaveLength(HOOK_TYPE_CATALOG.length + SCRIPT_PRINCIPLES.length + STORY_FORMATS.length);
});

test("선택 비트는 화면에서도 선택이라고 알려준다", () => {
  const html = render();

  expect(html).toContain("선택");
});

test("내 릴스 사례가 있으면 해당 유형 아래에 붙인다", () => {
  const html = render({
    contrarian: [
      {
        reelId: "r1",
        reelTitle: "역발상 릴스",
        line: "선크림보다 블루베리 소스가 낫습니다",
        template: "[통념]보다 [반전]이 낫습니다",
        why: "기대와 어긋나서",
      },
    ],
  });

  expect(html).toContain("내 릴스에서 나온 사례");
  expect(html).toContain("선크림보다 블루베리 소스가 낫습니다");
  expect(html).toContain("역발상 릴스");
});

test("사례가 없으면 사례 영역을 만들지 않는다", () => {
  expect(render()).not.toContain("내 릴스에서 나온 사례");
});

test("손가락으로 누를 수 있는 크기를 지킨다", () => {
  expect(render()).toContain("min-h-11");
});
