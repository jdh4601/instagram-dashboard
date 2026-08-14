import { reelIdFromPathname, shouldShowChatPanel } from "@/lib/chat/panelRoute";

test("설정 화면에서는 패널을 그리지 않는다", () => {
  expect(shouldShowChatPanel("/settings")).toBe(false);
  expect(shouldShowChatPanel("/settings/anything")).toBe(false);
});

test("나머지 화면에서는 패널을 그린다", () => {
  for (const pathname of ["/", "/reels", "/reel/abc123", "/hooks"]) {
    expect(shouldShowChatPanel(pathname)).toBe(true);
  }
});

test("릴스 상세 경로에서 릴스 id를 꺼낸다", () => {
  expect(reelIdFromPathname("/reel/17912345678901234")).toBe("17912345678901234");
});

test("경로 뒤에 세그먼트가 더 붙어도 id만 꺼낸다", () => {
  expect(reelIdFromPathname("/reel/abc123/")).toBe("abc123");
});

test("릴스 상세가 아닌 경로에서는 id가 없다", () => {
  for (const pathname of ["/", "/reels", "/reel", "/reel/", "/hooks", "/settings"]) {
    expect(reelIdFromPathname(pathname)).toBeNull();
  }
});
