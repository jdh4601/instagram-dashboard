import { renderToStaticMarkup } from "react-dom/server";
import { HookCatalog } from "@/components/HookCatalog";
import { HookTypeCard } from "@/components/HookTypePicker";
import { HOOK_TYPE_CATALOG } from "@/lib/analysis/hookCatalog";
import { SCRIPT_PRINCIPLES } from "@/lib/analysis/scriptPrinciples";
import type { HookExample } from "@/lib/ui/hookExamples";
import type { HookType } from "@/lib/schemas/reelAnalysis";

function render(examples: Partial<Record<HookType, HookExample[]>> = {}): string {
  return renderToStaticMarkup(<HookCatalog examples={examples} />);
}

test("카탈로그는 두 묶음의 제목을 내건다", () => {
  const html = render();

  expect(html).toContain("훅 유형 카탈로그");
  expect(html).toContain("스크립트 원리");
});

test("스토리텔링 포맷은 자기 페이지로 떠나 카탈로그에 남지 않는다", () => {
  expect(render()).not.toContain("스토리텔링 포맷");
});

test("훅 7유형·원리 8종의 라벨이 모두 나온다", () => {
  const html = render();

  // 훅 유형은 설명 대신 고르는 버튼으로 나오지만, 라벨은 그대로 다 보여야 한다.
  for (const spec of HOOK_TYPE_CATALOG) expect(html).toContain(spec.label);
  for (const spec of SCRIPT_PRINCIPLES) expect(html).toContain(spec.label);
});

test("훅 유형은 고르기 전까지 설명을 펼치지 않는다", () => {
  const html = render();

  // 7종을 한꺼번에 늘어놓으면 아래 묶음이 화면 밖으로 밀려난다.
  for (const spec of HOOK_TYPE_CATALOG) expect(html).not.toContain(spec.principle);
  expect(html).not.toContain("언제 쓰는가");
});

test("훅 유형 7종이 모두 누를 수 있는 버튼으로 나온다", () => {
  const html = render();
  const pressed = html.match(/aria-pressed="false"/g) ?? [];

  expect(html).toContain('aria-label="훅 유형 고르기"');
  expect(pressed.length).toBeGreaterThanOrEqual(HOOK_TYPE_CATALOG.length);
});

test("고른 유형의 카드는 원리·템플릿·예시를 함께 보여준다", () => {
  const spec = HOOK_TYPE_CATALOG[1];
  const html = renderToStaticMarkup(<HookTypeCard spec={spec} examples={[]} />);

  expect(html).toContain(spec.label);
  expect(html).toContain(spec.principle);
  expect(html).toContain("언제 쓰는가");
  expect(html).toContain(spec.templates[0]);
  expect(html).toContain(spec.examples[0]);
  expect(html).toContain("전체 복사");
});

test("접었다 펼치는 구조라 기본은 닫혀 있다", () => {
  const html = render();

  expect(html).toContain('aria-expanded="false"');
});

test("복사 버튼은 묶음 단위로만 붙는다", () => {
  const html = render();
  const copyButtons = html.match(/전체 복사/g) ?? [];

  // 원리 8종. 훅 유형은 고른 카드에만 붙으므로 기본 상태에서는 없다.
  expect(copyButtons).toHaveLength(SCRIPT_PRINCIPLES.length);
});

test("내 릴스 사례가 있으면 그 유형 카드 안에 붙인다", () => {
  const html = renderToStaticMarkup(
    <HookTypeCard
      spec={HOOK_TYPE_CATALOG[1]}
      examples={[
        {
          reelId: "r1",
          reelTitle: "역발상 릴스",
          line: "선크림보다 블루베리 소스가 낫습니다",
          template: "[통념]보다 [반전]이 낫습니다",
          why: "기대와 어긋나서",
        },
      ]}
    />,
  );

  expect(html).toContain("내 릴스에서 나온 사례");
  expect(html).toContain("선크림보다 블루베리 소스가 낫습니다");
  expect(html).toContain("역발상 릴스");
});

test("사례가 없으면 사례 영역을 만들지 않는다", () => {
  const html = renderToStaticMarkup(<HookTypeCard spec={HOOK_TYPE_CATALOG[1]} examples={[]} />);

  expect(html).not.toContain("내 릴스에서 나온 사례");
});

test("손가락으로 누를 수 있는 크기를 지킨다", () => {
  expect(render()).toContain("min-h-11");
});
