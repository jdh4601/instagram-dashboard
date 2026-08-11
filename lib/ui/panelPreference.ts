export const PANEL_STORAGE_KEY = "chatPanelExpanded";

/** localStorage 중 실제로 쓰는 두 메서드만. 테스트에서 가짜를 끼우기 쉽게 좁혔다. */
export interface PanelStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const COLLAPSED = "collapsed";
const EXPANDED = "expanded";

/**
 * 접기 상태를 읽는다. 기본값은 열림 — 처음 오는 사람에게 진단 AI가 있다는 걸
 * 보여야 해서, 모르는 값이나 저장소 실패도 전부 열림으로 되돌린다.
 *
 * 시크릿 모드·저장소 차단 환경에서 localStorage 접근 자체가 예외를 던지므로 감싼다.
 */
export function readPanelExpanded(storage: PanelStorage | null): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(PANEL_STORAGE_KEY) !== COLLAPSED;
  } catch {
    return true;
  }
}

export function writePanelExpanded(storage: PanelStorage | null, expanded: boolean): void {
  if (!storage) return;
  try {
    storage.setItem(PANEL_STORAGE_KEY, expanded ? EXPANDED : COLLAPSED);
  } catch {
    // 저장에 실패해도 이번 세션의 화면은 이미 바뀌어 있다. 되돌릴 것이 없다.
  }
}
