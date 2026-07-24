import type { SyncProgress } from "@/lib/graph/sync";

// 막대 너비(%)로 그대로 쓰이므로 범위를 벗어난 값이 들어와도 레이아웃이 깨지지 않게 자른다.
export function syncProgressPercent({ completed, total }: SyncProgress): number {
  if (total <= 0) return 0;
  const ratio = (completed / total) * 100;
  return Math.min(100, Math.max(0, Math.round(ratio)));
}

export function syncProgressLabel({ completed, total }: SyncProgress): string {
  // 목록을 받기 전에는 총 수를 모른다. "0 / 0 게시물"은 실패처럼 읽힌다.
  if (total <= 0) return "게시물 목록을 가져오는 중";
  return `${completed} / ${total} 게시물`;
}
