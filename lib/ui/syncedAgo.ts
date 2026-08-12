import { DAY_MS, HOUR_MS, MINUTE_MS } from "@/lib/time";

/**
 * 동기화 버튼 옆에 붙는 신선도 표기. 초 단위 정확도는 쓸모가 없고 "얼마나 오래된
 * 화면을 보고 있는가"만 알면 되므로 가장 큰 단위 하나로 줄인다.
 *
 * 기준 시각을 주입받아 테스트를 고정한다(UploadRhythmCard와 같은 규약).
 */
export function syncedAgoLabel(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null;

  const synced = Date.parse(iso);
  if (Number.isNaN(synced)) return null;

  // 서버와 브라우저 시계가 어긋나면 음수가 나온다. 미래는 방금으로 접는다.
  const elapsed = Math.max(0, now.getTime() - synced);
  if (elapsed < MINUTE_MS) return "방금 동기화";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}분 전 동기화`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}시간 전 동기화`;
  return `${Math.floor(elapsed / DAY_MS)}일 전 동기화`;
}
