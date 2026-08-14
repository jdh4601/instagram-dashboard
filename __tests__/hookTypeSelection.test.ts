import { findHookTypeSpec, toggleHookType } from "@/lib/ui/hookTypeSelection";

test("아무것도 안 고른 상태에서 하나를 고르면 그게 열린다", () => {
  expect(toggleHookType(null, "contrarian")).toBe("contrarian");
});

test("다른 유형을 고르면 그쪽으로 갈아탄다", () => {
  expect(toggleHookType("problem", "curiosity")).toBe("curiosity");
});

test("열려 있는 유형을 다시 누르면 닫힌다", () => {
  // 설명을 접을 방법이 없으면 한 번 연 뒤로는 목록이 계속 길어진 채로 남는다.
  expect(toggleHookType("problem", "problem")).toBeNull();
});

test("고른 유형의 카탈로그 항목을 찾아 준다", () => {
  expect(findHookTypeSpec("contrarian")?.label).toBe("역발상");
});

test("고른 게 없거나 모르는 값이면 아무것도 주지 않는다", () => {
  expect(findHookTypeSpec(null)).toBeNull();
});
