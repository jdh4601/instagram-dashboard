import { HOOK_TYPE_CATALOG, type HookTypeSpec } from "@/lib/analysis/hookCatalog";
import type { HookType } from "@/lib/schemas/reelAnalysis";

/**
 * 카탈로그에서 펼쳐 볼 훅 유형을 고른다. 열려 있는 유형을 다시 누르면 닫는다 —
 * 접는 방법이 없으면 한 번 연 뒤로 목록이 계속 길어진 채로 남는다.
 */
export function toggleHookType(current: HookType | null, next: HookType): HookType | null {
  return current === next ? null : next;
}

export function findHookTypeSpec(id: HookType | null): HookTypeSpec | null {
  if (!id) return null;
  return HOOK_TYPE_CATALOG.find((spec) => spec.id === id) ?? null;
}
