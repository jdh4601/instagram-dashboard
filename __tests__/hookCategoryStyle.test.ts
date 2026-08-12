import { expect, test } from "vitest";
import { HOOK_CATEGORY_CLASSES } from "@/lib/ui/hookCategoryStyle";
import { HOOK_CATEGORIES } from "@/lib/schemas";

test("분류마다 배지 색이 있다", () => {
  for (const category of HOOK_CATEGORIES) {
    expect(HOOK_CATEGORY_CLASSES[category]).toBeTruthy();
  }
});

test("다섯 분류의 색이 서로 다르다", () => {
  // 같은 색이 둘이면 라벨만 보고 유형을 가려낼 수 없다. 이 화면의 목적이 그거다.
  const classes = HOOK_CATEGORIES.map((category) => HOOK_CATEGORY_CLASSES[category]);

  expect(new Set(classes).size).toBe(HOOK_CATEGORIES.length);
});

test("배지 색은 테마 토큰을 쓴다", () => {
  // 팔레트를 하드코딩하면 다크 테마에서 대비가 무너진다.
  for (const category of HOOK_CATEGORIES) {
    expect(HOOK_CATEGORY_CLASSES[category]).toContain("hook-");
  }
});
