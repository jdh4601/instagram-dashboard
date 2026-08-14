import { NAV_ITEMS, isNavActive, isNavItemActive } from "@/lib/ui/navigation";

test("사이드바는 여섯 개 탭을 이 순서로 노출한다", () => {
  expect(NAV_ITEMS.map((item) => item.href)).toEqual([
    "/",
    "/reels",
    "/carousels",
    "/hooks",
    "/story-formats",
    "/settings",
  ]);
  expect(NAV_ITEMS.map((item) => item.label)).toEqual([
    "대시보드",
    "릴스",
    "캐러셀",
    "훅 저장소",
    "스토리텔링 포맷",
    "설정",
  ]);
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

test("캐러셀 탭은 캐러셀 경로에서만 켜진다", () => {
  const carousels = NAV_ITEMS.find((item) => item.href === "/carousels")!;
  const reels = NAV_ITEMS.find((item) => item.href === "/reels")!;

  expect(isNavItemActive("/carousels", carousels)).toBe(true);
  expect(isNavItemActive("/carousels", reels)).toBe(false);
  expect(isNavItemActive("/reels", carousels)).toBe(false);
});

test("게시물 상세는 릴스 탭에 묶인다", () => {
  // 캐러셀도 같은 /reel/:id 상세를 쓴다. 상세에서 켜질 탭은 하나뿐이라 목록 탭 하나에 묶는다.
  const reels = NAV_ITEMS.find((item) => item.href === "/reels")!;
  expect(isNavItemActive("/reel/17900000000000000", reels)).toBe(true);
});
