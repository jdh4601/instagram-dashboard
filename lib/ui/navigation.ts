export interface NavItem {
  href: string;
  label: string;
  /** 이 탭을 활성으로 볼 경로 접두사들. 상세 화면(/reel/:id)도 목록 탭에 묶어야 길을 잃지 않는다. */
  activePrefixes: string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "대시보드", activePrefixes: ["/"] },
  // 캐러셀도 상세는 /reel/:id를 함께 쓴다. 상세에서 켜질 탭은 하나여야 하므로 목록 탭 하나에 묶는다.
  { href: "/reels", label: "릴스", activePrefixes: ["/reels", "/reel"] },
  { href: "/carousels", label: "캐러셀", activePrefixes: ["/carousels"] },
  { href: "/hooks", label: "훅 저장소", activePrefixes: ["/hooks"] },
  { href: "/story-formats", label: "스토리텔링 포맷", activePrefixes: ["/story-formats"] },
  { href: "/settings", label: "설정", activePrefixes: ["/settings"] },
];

export function isNavActive(pathname: string, prefix: string): boolean {
  // "/"는 모든 경로의 접두사라 접두사 규칙을 그대로 쓰면 항상 켜진다.
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return item.activePrefixes.some((prefix) => isNavActive(pathname, prefix));
}
