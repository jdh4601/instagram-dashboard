import { syncProgressLabel, syncProgressPercent } from "@/lib/ui/syncProgress";

test("총 게시물이 0이면 0%다 — 목록을 아직 받지 못한 상태", () => {
  expect(syncProgressPercent({ completed: 0, total: 0 })).toBe(0);
});

test("진행률은 완료 수 ÷ 총 수를 정수 퍼센트로 돌려준다", () => {
  expect(syncProgressPercent({ completed: 12, total: 36 })).toBe(33);
  expect(syncProgressPercent({ completed: 36, total: 36 })).toBe(100);
});

// 막대 너비로 그대로 쓰이므로 범위를 벗어난 값이 레이아웃을 깨지 않아야 한다.
test("진행률은 0~100 범위로 잘린다", () => {
  expect(syncProgressPercent({ completed: 40, total: 36 })).toBe(100);
  expect(syncProgressPercent({ completed: -1, total: 36 })).toBe(0);
});

test("라벨은 완료 수와 총 수를 함께 보여준다", () => {
  expect(syncProgressLabel({ completed: 12, total: 36 })).toBe("12 / 36 게시물");
});

// 목록을 받기 전에는 총 수를 모른다. "0 / 0 게시물"은 실패처럼 읽히므로 문구를 나눈다.
test("총 수를 모르면 게시물 수 대신 준비 중이라고 알린다", () => {
  expect(syncProgressLabel({ completed: 0, total: 0 })).toBe("게시물 목록을 가져오는 중");
});
