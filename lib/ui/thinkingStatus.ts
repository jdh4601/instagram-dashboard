/**
 * 답변이 오기 전까지 보여줄 진행 문구.
 *
 * 문구는 챗봇이 실제로 훑는 순서를 따른다(lib/chat/context.ts의 buildAccountContext:
 * 프로필·지표 → 최근 게시물 → 퍼널 → 진단 → 정리). 실제 단계와 무관한 문구를 돌리면
 * 기다림은 짧게 느껴져도 무엇을 기다리는지는 여전히 알 수 없다.
 */
export const THINKING_STAGES = [
  "계정 지표를 읽는 중",
  "최근 게시물을 훑는 중",
  "퍼널 구간을 비교하는 중",
  "성과가 갈린 지점을 찾는 중",
  "진단을 정리하는 중",
] as const;

/** 한 단계에 머무는 시간. 첫 토큰까지 보통 2~4초라 대부분 두세 단계에서 끝난다. */
export const THINKING_STAGE_MS = 2200;

/**
 * 경과 시간(ms) → 지금 보여줄 문구.
 *
 * 마지막 단계에서 멈추고 순환하지 않는다. 되돌아가면 방금 끝낸 일을 다시 하는 것처럼
 * 보여서, 오래 걸릴수록 진행이 뒤로 감기는 인상을 준다.
 */
export function thinkingStageAt(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return THINKING_STAGES[0];
  const index = Math.floor(elapsedMs / THINKING_STAGE_MS);
  return THINKING_STAGES[Math.min(index, THINKING_STAGES.length - 1)];
}
