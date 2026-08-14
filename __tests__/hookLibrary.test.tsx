import { renderToStaticMarkup } from "react-dom/server";
import { HookLibrary } from "@/components/HookLibrary";
import type { Hook } from "@/lib/schemas";

function hook(id: string, overrides: Partial<Hook> = {}): Hook {
  return {
    id,
    text: "이걸 모르면 1년을 날립니다",
    category: "problem",
    isFavorite: false,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    ...overrides,
  };
}

function render(hooks: Hook[]): string {
  return renderToStaticMarkup(
    <HookLibrary
      hooks={hooks}
      onSave={async () => undefined}
      onToggleFavorite={async () => undefined}
      onDelete={async () => undefined}
    />,
  );
}

test("훅이 없으면 무엇을 하면 되는지 알려준다", () => {
  const html = render([]);

  expect(html).toContain("아직 담아 둔 훅이 없습니다");
  expect(html).toContain("훅 추가");
});

test("섹션 헤더에 개수를 함께 보여준다", () => {
  const html = render([hook("h1", { isFavorite: true }), hook("h2"), hook("h3")]);

  expect(html).toContain("즐겨찾는 훅");
  expect(html).toContain("전체 훅");
  // 즐겨찾기 1건 / 전체 3건 — 즐겨찾기를 전체에서 빼지 않는다.
  expect(html).toContain("1");
  expect(html).toContain("3");
});

test("즐겨찾기가 없으면 즐겨찾기 섹션을 띄우지 않는다", () => {
  const html = render([hook("h1")]);

  expect(html).not.toContain("즐겨찾는 훅");
  expect(html).toContain("전체 훅");
});

test("행은 훅 문장과 영감 준 계정을 함께 보여준다", () => {
  const html = render([hook("h1", { sourceHandle: "wearedone.kr" })]);

  expect(html).toContain("이걸 모르면 1년을 날립니다");
  expect(html).toContain("Inspired by");
  expect(html).toContain("@wearedone.kr");
});

test("영감 준 계정이 없으면 빈 Inspired by 줄을 만들지 않는다", () => {
  const html = render([hook("h1")]);

  expect(html).not.toContain("Inspired by");
});

test("분류는 한국어 배지로 보여준다", () => {
  const html = render([hook("h1", { category: "contrarian" })]);
  // 배지 색이 분류 토큰을 쓰면서 class에 영문 값이 들어간다. 사람이 읽는 것은
  // 태그를 걷어낸 글자뿐이라, 거기에만 영문 값이 없으면 된다.
  const visibleText = html.replace(/<[^>]*>/g, " ");

  expect(visibleText).toContain("역발상");
  expect(visibleText).not.toContain("contrarian");
});

test("분류마다 배지 색이 갈린다", () => {
  const problem = render([hook("h1", { category: "problem" })]);
  const curiosity = render([hook("h1", { category: "curiosity" })]);

  expect(problem).toContain("text-hook-problem");
  expect(curiosity).toContain("text-hook-curiosity");
});

test("조회수는 축약해서 배지에 담는다", () => {
  const html = render([hook("h1", { views: 92000 })]);

  expect(html).toContain("9.2만");
});

test("조회수를 모르면 조회수 배지를 만들지 않는다", () => {
  const html = render([hook("h1", { views: 92000 })]);
  const without = render([hook("h1")]);

  expect(html).toContain('aria-label="조회수 9.2만"');
  expect(without).not.toContain("조회수 ");
});

test("썸네일이 있으면 이미지로, 없으면 자리표시자로 채운다", () => {
  const withThumb = render([hook("h1", { thumbnailUrl: "https://cdn/t.jpg" })]);

  expect(withThumb).toContain('src="https://cdn/t.jpg"');
  expect(render([hook("h1")])).not.toContain("<img");
});

test("하트는 현재 즐겨찾기 상태를 보조기술에 알린다", () => {
  const on = render([hook("h1", { isFavorite: true })]);
  const off = render([hook("h1")]);

  expect(on).toContain('aria-pressed="true"');
  expect(off).toContain('aria-pressed="false"');
  expect(off).toContain("즐겨찾기");
});

test("분류·정렬 컨트롤이 상단에 있다", () => {
  const html = render([hook("h1")]);

  expect(html).toContain("최신순");
  expect(html).toContain("조회수순");
  expect(html).toContain("전체 분류");
});

test("검색창은 두지 않는다", () => {
  // 보관함은 한 화면에 들어오는 크기라 분류 칩만으로 충분하다.
  const html = render([hook("h1")]);

  expect(html).not.toContain("검색");
  expect(html).not.toContain("<input");
});

test("손가락으로 누를 수 있는 크기를 지킨다", () => {
  const html = render([hook("h1")]);

  expect(html).toContain("min-h-11");
});

test("원본 링크는 새 탭에서 열고 참조를 끊는다", () => {
  const html = render([hook("h1", { sourceUrl: "https://instagram.com/reel/abc" })]);

  expect(html).toContain('href="https://instagram.com/reel/abc"');
  expect(html).toContain('rel="noreferrer noopener"');
});

test("썸네일은 릴스 비율 9:16으로 보여준다", () => {
  const withThumb = render([hook("h1", { thumbnailUrl: "https://cdn.example.com/a.jpg" })]);
  const withoutThumb = render([hook("h2")]);

  expect(withThumb).toContain("aspect-[9/16]");
  // 빈 자리도 같은 모양이어야 목록의 줄 높이가 들쭉날쭉하지 않다.
  expect(withoutThumb).toContain("aspect-[9/16]");
});
