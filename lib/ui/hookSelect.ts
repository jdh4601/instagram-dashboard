import type { Hook, HookCategory } from "@/lib/schemas";

export type HookSort = "latest" | "views" | "text";

export const HOOK_SORT_LABELS: Record<HookSort, string> = {
  latest: "최신순",
  views: "조회수순",
  text: "가나다순",
};

/** "all" = 분류를 안 가린다. 필터 칩의 기본값이다. */
export type HookCategoryFilter = HookCategory | "all";

function matches(hook: Hook, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // 화면에는 핸들 앞에 @가 보이므로 사용자가 @까지 쳐도 걸려야 한다.
  const needle = q.startsWith("@") ? q.slice(1) : q;
  const haystack =
    `${hook.text} ${hook.sourceHandle ?? ""} ${hook.note ?? ""}`.toLowerCase();
  return haystack.includes(needle);
}

function compare(a: Hook, b: Hook, sort: HookSort): number {
  if (sort === "views") {
    // 조회수를 모르는 훅은 뒤로 보내되 목록에서 빼지는 않는다 —
    // 사라지면 사용자가 훅이 지워진 줄 안다.
    return (b.views ?? -1) - (a.views ?? -1);
  }
  if (sort === "text") return a.text.localeCompare(b.text, "ko");
  return b.createdAt.localeCompare(a.createdAt); // latest
}

// 검색(훅 문장·계정·메모) + 분류 필터 + 정렬. 순수 — 원본 불변.
export function selectHooks(
  hooks: Hook[],
  query: string,
  category: HookCategoryFilter,
  sort: HookSort,
): Hook[] {
  return hooks
    .filter((hook) => (category === "all" || hook.category === category) && matches(hook, query))
    .sort((a, b) => compare(a, b, sort));
}

export interface HookSections {
  favorites: Hook[];
  all: Hook[];
}

/**
 * 화면의 두 섹션으로 가른다.
 *
 * 즐겨찾기를 전체에서 빼지 않고 위로 한 벌 더 띄운다. 빼 버리면 "전체 훅 · N"의
 * N이 실제 보관 개수와 어긋나 사용자가 훅을 잃어버린 줄 안다.
 */
export function splitHookSections(hooks: Hook[]): HookSections {
  return { favorites: hooks.filter((hook) => hook.isFavorite), all: hooks };
}
