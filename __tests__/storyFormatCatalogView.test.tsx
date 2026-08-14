import { renderToStaticMarkup } from "react-dom/server";
import { StoryFormatCatalog } from "@/components/StoryFormatCatalog";
import { STORY_FORMATS } from "@/lib/analysis/storyFormats";

function render(): string {
  return renderToStaticMarkup(<StoryFormatCatalog />);
}

test("포맷 10종을 접지 않고 한 번에 펼친다", () => {
  const html = render();

  // 훅 카탈로그에 얹혀 있을 땐 접혀 있었지만, 자기 페이지에서는 바로 읽혀야 한다.
  for (const format of STORY_FORMATS) {
    expect(html).toContain(format.label);
    expect(html).toContain(format.description);
  }
  expect(html).not.toContain('aria-expanded="false"');
});

test("포맷마다 비트 시퀀스와 아웃라이어 조건을 함께 보여준다", () => {
  const html = render();

  expect(html).toContain("아웃라이어 조건");
  expect(html).toContain("비트 시퀀스");
  expect(html).toContain(STORY_FORMATS[0].beats[0].label);
  expect(html).toContain(STORY_FORMATS[0].secretSauce[0]);
});

test("선택 비트는 화면에서도 선택이라고 알려준다", () => {
  expect(render()).toContain("선택");
});

test("포맷마다 통째로 복사하는 버튼이 하나씩 붙는다", () => {
  const copyButtons = render().match(/전체 복사/g) ?? [];

  expect(copyButtons).toHaveLength(STORY_FORMATS.length);
});
