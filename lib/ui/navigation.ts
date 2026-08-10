export interface NavItem {
  href: string;
  label: string;
  /** 이 탭을 활성으로 볼 경로 접두사들. 상세 화면(/reel/:id)도 목록 탭에 묶어야 길을 잃지 않는다. */
  activePrefixes: string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "대시보드", activePrefixes: ["/"] },
  { href: "/reels", label: "릴스", activePrefixes: ["/reels", "/reel"] },
  { href: "/hooks", label: "훅", activePrefixes: ["/hooks"] },
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
