import { selectHooks, splitHookSections, HOOK_SORT_LABELS } from "@/lib/ui/hookSelect";
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

test("검색어가 없으면 전부 남긴다", () => {
  const hooks = [hook("h1"), hook("h2")];

  expect(selectHooks(hooks, "  ", "all", "latest")).toHaveLength(2);
});

test("훅 문장으로 검색한다", () => {
  const hooks = [hook("h1", { text: "3년을 3개월로" }), hook("h2", { text: "아무도 안 알려준 것" })];

  expect(selectHooks(hooks, "3개월", "all", "latest").map((h) => h.id)).toEqual(["h1"]);
});

test("영감 준 계정으로도 검색된다", () => {
  const hooks = [hook("h1", { sourceHandle: "wearedone.kr" }), hook("h2")];

  // @를 붙여 치든 안 붙이든 같은 결과여야 한다 — 화면에 @가 보이기 때문이다.
  expect(selectHooks(hooks, "@wearedone", "all", "latest").map((h) => h.id)).toEqual(["h1"]);
  expect(selectHooks(hooks, "wearedone", "all", "latest").map((h) => h.id)).toEqual(["h1"]);
});

test("검색은 대소문자를 가리지 않는다", () => {
  const hooks = [hook("h1", { sourceHandle: "WeAreDone" })];

  expect(selectHooks(hooks, "wearedone", "all", "latest")).toHaveLength(1);
});

test("메모로도 검색된다", () => {
  const hooks = [hook("h1", { note: "숫자를 앞에 두는 게 핵심" }), hook("h2")];

  expect(selectHooks(hooks, "숫자를", "all", "latest").map((h) => h.id)).toEqual(["h1"]);
});

test("카테고리로 좁힌다", () => {
  const hooks = [hook("h1", { category: "problem" }), hook("h2", { category: "curiosity" })];

  expect(selectHooks(hooks, "", "curiosity", "latest").map((h) => h.id)).toEqual(["h2"]);
  expect(selectHooks(hooks, "", "all", "latest")).toHaveLength(2);
});

test("검색과 카테고리는 함께 걸린다", () => {
  const hooks = [
    hook("h1", { category: "problem", text: "1년을 날립니다" }),
    hook("h2", { category: "curiosity", text: "1년을 날립니다" }),
  ];

  expect(selectHooks(hooks, "1년", "problem", "latest").map((h) => h.id)).toEqual(["h1"]);
});

test("최신순은 나중에 담은 훅을 위로 올린다", () => {
  const hooks = [
    hook("old", { createdAt: "2026-08-01T09:00:00.000Z" }),
    hook("new", { createdAt: "2026-08-05T09:00:00.000Z" }),
  ];

  expect(selectHooks(hooks, "", "all", "latest").map((h) => h.id)).toEqual(["new", "old"]);
});

test("조회수순은 조회수 없는 훅을 뒤로 보낸다", () => {
  const hooks = [
    hook("없음"),
    hook("적음", { views: 1000 }),
    hook("많음", { views: 90000 }),
  ];

  // 목록에서 빼지는 않는다 — 사라지면 훅이 지워진 줄 안다.
  expect(selectHooks(hooks, "", "all", "views").map((h) => h.id)).toEqual([
    "많음",
    "적음",
    "없음",
  ]);
});

test("가나다순은 훅 문장을 기준으로 한다", () => {
  const hooks = [hook("h1", { text: "하나" }), hook("h2", { text: "가나" })];

  expect(selectHooks(hooks, "", "all", "text").map((h) => h.id)).toEqual(["h2", "h1"]);
});

test("정렬은 원본 배열을 건드리지 않는다", () => {
  const hooks = [hook("a", { views: 1 }), hook("b", { views: 2 })];

  selectHooks(hooks, "", "all", "views");

  expect(hooks.map((h) => h.id)).toEqual(["a", "b"]);
});

test("섹션은 즐겨찾기를 위로 뽑고 전체는 그대로 둔다", () => {
  const hooks = [hook("h1", { isFavorite: true }), hook("h2")];

  const sections = splitHookSections(hooks);

  // 즐겨찾기는 전체에서 빼지 않고 위로 한 벌 더 띄운다. 빼면 "전체 N"이 거짓말이 된다.
  expect(sections.favorites.map((h) => h.id)).toEqual(["h1"]);
  expect(sections.all.map((h) => h.id)).toEqual(["h1", "h2"]);
});

test("즐겨찾기가 없으면 빈 섹션을 준다", () => {
  expect(splitHookSections([hook("h1")]).favorites).toEqual([]);
});

test("정렬 라벨은 모든 정렬 기준을 덮는다", () => {
  expect(Object.keys(HOOK_SORT_LABELS)).toEqual(["latest", "views", "text"]);
});
