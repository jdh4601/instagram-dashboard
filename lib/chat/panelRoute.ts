/**
 * 진단 패널이 경로에 따라 어떻게 달라지는지만 정하는 순수 함수 모음.
 *
 * AppShell이 `usePathname()`으로 읽은 값을 넘겨 준다 — Sidebar와 같은 방식이다.
 * 판단을 컴포넌트 밖에 두면 렌더 없이 규칙만 테스트할 수 있다.
 */

/** 설정 화면은 폼이 넓어 패널과 나란히 서면 입력칸이 짜부라진다. 거기서만 숨긴다. */
const HIDDEN_PREFIX = "/settings";

export function shouldShowChatPanel(pathname: string): boolean {
  return pathname !== HIDDEN_PREFIX && !pathname.startsWith(`${HIDDEN_PREFIX}/`);
}

/**
 * 릴스 상세 경로에서 릴스 id를 꺼낸다.
 *
 * 이 값이 있으면 질문에 릴스를 지목하는 말이 없어도 그 릴스를 컨텍스트에 싣는다 —
 * 상세 화면을 띄워 놓고 "이거 훅 왜 약해?"라고 묻는 게 가장 흔한 사용법이다.
 */
export function reelIdFromPathname(pathname: string): string | null {
  const match = /^\/reel\/([^/]+)\/?$/.exec(pathname);
  return match ? match[1] : null;
}
