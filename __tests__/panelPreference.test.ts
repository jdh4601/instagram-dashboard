import { readPanelExpanded, writePanelExpanded, PANEL_STORAGE_KEY } from "@/lib/ui/panelPreference";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    dump: () => Object.fromEntries(map),
  };
}

test("저장된 값이 없으면 넓은 화면 기본값인 열림으로 시작한다", () => {
  expect(readPanelExpanded(fakeStorage())).toBe(true);
});

test("접어 둔 상태는 다음 방문에도 남는다", () => {
  const storage = fakeStorage();
  writePanelExpanded(storage, false);

  expect(storage.dump()[PANEL_STORAGE_KEY]).toBe("collapsed");
  expect(readPanelExpanded(storage)).toBe(false);
});

test("펼친 상태도 그대로 남는다", () => {
  const storage = fakeStorage();
  writePanelExpanded(storage, true);

  expect(readPanelExpanded(storage)).toBe(true);
});

test("알 수 없는 값은 기본값으로 되돌린다", () => {
  // 다른 버전이 남긴 값이나 사람이 손으로 고친 값이 화면을 깨뜨리면 안 된다.
  expect(readPanelExpanded(fakeStorage({ [PANEL_STORAGE_KEY]: "yes" }))).toBe(true);
  expect(readPanelExpanded(fakeStorage({ [PANEL_STORAGE_KEY]: "" }))).toBe(true);
});

test("저장소를 쓸 수 없어도 기본값으로 동작한다", () => {
  // 시크릿 모드나 저장소 차단 환경에서 localStorage 접근은 예외를 던진다.
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };

  expect(readPanelExpanded(blocked)).toBe(true);
  expect(() => writePanelExpanded(blocked, false)).not.toThrow();
});

test("저장소가 없는 서버 렌더에서도 기본값을 준다", () => {
  expect(readPanelExpanded(null)).toBe(true);
});
