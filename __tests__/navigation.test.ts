import { NAV_ITEMS, isNavActive } from "@/lib/ui/navigation";

test("사이드바는 대시보드·릴스·훅·설정 네 개를 이 순서로 노출한다", () => {
  expect(NAV_ITEMS.map((item) => item.href)).toEqual(["/", "/reels", "/hooks", "/settings"]);
  expect(NAV_ITEMS.map((item) => item.label)).toEqual(["대시보드", "릴스", "훅", "설정"]);
});

test("현재 경로와 같은 탭이 활성으로 표시된다", () => {
  expect(isNavActive("/reels", "/reels")).toBe(true);
  expect(isNavActive("/reels", "/hooks")).toBe(false);
});

test("하위 경로에서도 상위 탭이 활성으로 남는다", () => {
  // /reel/123 상세로 들어가도 릴스 탭이 켜져 있어야 길을 잃지 않는다.
  expect(isNavActive("/reels/123", "/reels")).toBe(true);
  expect(isNavActive("/settings/walla", "/settings")).toBe(true);
});

test("루트 탭은 정확히 루트일 때만 활성이다", () => {
  // "/" 는 모든 경로의 접두사라 접두사 규칙을 그대로 쓰면 항상 켜진다.
  expect(isNavActive("/", "/")).toBe(true);
  expect(isNavActive("/reels", "/")).toBe(false);
  expect(isNavActive("/hooks", "/")).toBe(false);
});

test("이름이 비슷한 형제 경로를 활성으로 착각하지 않는다", () => {
  expect(isNavActive("/reelsx", "/reels")).toBe(false);
});
