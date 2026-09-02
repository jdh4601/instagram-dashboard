import {
  NAV_ITEMS,
  detailPathForMedia,
  isNavActive,
  isNavItemActive,
  listPathForMedia,
} from "@/lib/ui/navigation";

test("사이드바는 일곱 개 탭을 이 순서로 노출한다", () => {
  expect(NAV_ITEMS.map((item) => item.href)).toEqual([
    "/",
    "/reels",
    "/carousels",
    "/ads",
    "/hooks",
    "/story-formats",
    "/settings",
  ]);
  expect(NAV_ITEMS.map((item) => item.label)).toEqual([
    "대시보드",
    "릴스",
    "캐러셀",
    "광고",
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

test("상세에서 뒤로 가면 그 게시물이 있던 목록으로 돌아간다", () => {
  expect(listPathForMedia("REELS")).toBe("/reels");
  expect(listPathForMedia("CAROUSEL")).toBe("/carousels");
});

test("돌아갈 목록 경로는 실제 탭 주소와 같다", () => {
  // 탭 주소가 바뀌면 뒤로가기가 404로 떨어진다. 두 목록을 한 출처에 묶어 둔다.
  const hrefs = NAV_ITEMS.map((item) => item.href);
  expect(hrefs).toContain(listPathForMedia("REELS"));
  expect(hrefs).toContain(listPathForMedia("CAROUSEL"));
});

test("상세 경로는 종류마다 갈린다", () => {
  expect(detailPathForMedia("REELS", "179")).toBe("/reel/179");
  expect(detailPathForMedia("CAROUSEL", "179")).toBe("/carousel/179");
});

test("릴스 상세는 릴스 탭에, 캐러셀 상세는 캐러셀 탭에 묶인다", () => {
  const reels = NAV_ITEMS.find((item) => item.href === "/reels")!;
  const carousels = NAV_ITEMS.find((item) => item.href === "/carousels")!;

  expect(isNavItemActive("/reel/17900000000000000", reels)).toBe(true);
  expect(isNavItemActive("/reel/17900000000000000", carousels)).toBe(false);

  // 캐러셀을 눌렀는데 릴스 탭이 켜지던 문제. 상세가 갈렸으니 탭도 갈려야 한다.
  expect(isNavItemActive("/carousel/17900000000000000", carousels)).toBe(true);
  expect(isNavItemActive("/carousel/17900000000000000", reels)).toBe(false);
});

test("상세 경로는 그 종류의 상세 탭 접두사 안에 있다", () => {
  // 경로와 활성 규칙이 따로 놀면 상세에서 아무 탭도 켜지지 않는다.
  for (const item of NAV_ITEMS) {
    if (item.href === "/reels") expect(isNavItemActive(detailPathForMedia("REELS", "1"), item)).toBe(true);
    if (item.href === "/carousels") expect(isNavItemActive(detailPathForMedia("CAROUSEL", "1"), item)).toBe(true);
  }
});
