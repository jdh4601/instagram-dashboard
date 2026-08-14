import { renderToStaticMarkup } from "react-dom/server";
import { StoryFormatGrid } from "@/components/StoryFormatGrid";
import { StoryFormatDetail } from "@/components/StoryFormatDetail";
import { STORY_FORMATS } from "@/lib/analysis/storyFormats";

const sample = STORY_FORMATS.find((format) => format.id === "about-me")!;

function grid(): string {
  return renderToStaticMarkup(<StoryFormatGrid />);
}

test("목록은 포맷 10종을 라벨과 설명만으로 보여준다", () => {
  const html = grid();

  for (const format of STORY_FORMATS) {
    expect(html).toContain(format.label);
    expect(html).toContain(format.description);
  }
});

test("목록에서는 비트도 아웃라이어 조건도 펼치지 않는다", () => {
  const html = grid();

  // 10종의 비트를 한 화면에 늘어놓으면 무엇을 고를지 판단할 수 없다.
  expect(html).not.toContain("비트 시퀀스");
  expect(html).not.toContain("아웃라이어 조건");
  expect(html).not.toContain(sample.beats[0].templates[0]);
  expect(html).not.toContain(sample.secretSauce[0]);
});

test("카드마다 자기 상세 페이지로 들어가는 링크가 붙는다", () => {
  const html = grid();

  for (const format of STORY_FORMATS) {
    expect(html).toContain(`href="/story-formats/${format.id}"`);
  }
});

test("목록은 두 칸으로 쌓인다", () => {
  expect(grid()).toContain("sm:grid-cols-2");
});

test("상세는 비트 시퀀스와 아웃라이어 조건까지 전부 편다", () => {
  const html = renderToStaticMarkup(<StoryFormatDetail format={sample} />);

  expect(html).toContain(sample.label);
  expect(html).toContain(sample.description);
  expect(html).toContain("아웃라이어 조건");
  expect(html).toContain(sample.secretSauce[0]);
  expect(html).toContain("비트 시퀀스");
  for (const beat of sample.beats) expect(html).toContain(beat.label);
  expect(html).toContain(sample.beats[0].templates[0]);
});

test("상세에는 포맷을 통째로 복사하는 버튼이 하나 붙는다", () => {
  const html = renderToStaticMarkup(<StoryFormatDetail format={sample} />);
  const copyButtons = html.match(/전체 복사/g) ?? [];

  expect(copyButtons).toHaveLength(1);
});

test("선택 비트는 상세에서 선택이라고 알려준다", () => {
  const optional = STORY_FORMATS.find((format) => format.beats.some((beat) => beat.optional))!;
  const html = renderToStaticMarkup(<StoryFormatDetail format={optional} />);

  expect(html).toContain("선택");
});
