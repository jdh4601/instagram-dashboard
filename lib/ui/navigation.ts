import type { MediaKind } from "@/lib/schemas";

export interface NavItem {
  href: string;
  label: string;
  /** 이 탭을 활성으로 볼 경로 접두사들. 상세 화면도 제 목록 탭에 묶어야 길을 잃지 않는다. */
  activePrefixes: string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "대시보드", activePrefixes: ["/"] },
  { href: "/reels", label: "릴스", activePrefixes: ["/reels", "/reel"] },
  { href: "/carousels", label: "캐러셀", activePrefixes: ["/carousels", "/carousel"] },
  { href: "/ads", label: "광고 효율", activePrefixes: ["/ads"] },
  { href: "/hooks", label: "훅 저장소", activePrefixes: ["/hooks"] },
  { href: "/story-formats", label: "스토리텔링 포맷", activePrefixes: ["/story-formats"] },
  { href: "/settings", label: "설정", activePrefixes: ["/settings"] },
];

/**
 * 게시물 상세에서 돌아갈 목록 경로.
 *
 * 캐러셀을 보다가 뒤로 갔는데 릴스 목록이 나오면 왔던 자리를 잃는다.
 */
export function listPathForMedia(kind: MediaKind): string {
  return kind === "CAROUSEL" ? "/carousels" : "/reels";
}

/**
 * 게시물 상세 경로.
 *
 * 종류마다 경로를 가른다. 사이드바는 경로만 보고 탭을 켜므로, 두 종류가 한 경로를
 * 나눠 쓰면 캐러셀을 눌러도 릴스 탭이 켜진다 — 화면 내용과 사이드바가 어긋난다.
 */
export function detailPathForMedia(kind: MediaKind, id: string): string {
  return `${kind === "CAROUSEL" ? "/carousel" : "/reel"}/${id}`;
}

export function isNavActive(pathname: string, prefix: string): boolean {
  // "/"는 모든 경로의 접두사라 접두사 규칙을 그대로 쓰면 항상 켜진다.
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return item.activePrefixes.some((prefix) => isNavActive(pathname, prefix));
}
