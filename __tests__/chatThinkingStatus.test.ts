import {
  THINKING_STAGES,
  THINKING_STAGE_MS,
  thinkingStageAt,
} from "@/lib/ui/thinkingStatus";

test("시작 직후에는 첫 단계를 보여준다", () => {
  expect(thinkingStageAt(0)).toBe(THINKING_STAGES[0]);
  expect(thinkingStageAt(THINKING_STAGE_MS - 1)).toBe(THINKING_STAGES[0]);
});

test("한 구간이 지날 때마다 다음 단계로 넘어간다", () => {
  expect(thinkingStageAt(THINKING_STAGE_MS)).toBe(THINKING_STAGES[1]);
  expect(thinkingStageAt(THINKING_STAGE_MS * 2)).toBe(THINKING_STAGES[2]);
  expect(thinkingStageAt(THINKING_STAGE_MS * 3)).toBe(THINKING_STAGES[3]);
});

/**
 * 응답이 얼마나 걸릴지는 제공자와 질문 길이에 따라 다르다. 단계를 순환시키면
 * "정리하는 중" 다음에 "지표를 읽는 중"이 다시 나와 방금 끝난 일을 또 하는 것처럼
 * 보인다. 마지막 단계에서 멈춰야 진행이 뒤로 감기지 않는다.
 */
test("마지막 단계에 닿으면 더 넘어가지 않고 머문다", () => {
  const last = THINKING_STAGES[THINKING_STAGES.length - 1];
  expect(thinkingStageAt(THINKING_STAGE_MS * (THINKING_STAGES.length - 1))).toBe(last);
  expect(thinkingStageAt(THINKING_STAGE_MS * 50)).toBe(last);
});

/** 경과 시간은 타이머에서 온다. 음수·NaN이 와도 문구가 비면 안 된다. */
test("경과 시간이 이상해도 첫 단계로 버틴다", () => {
  expect(thinkingStageAt(-1000)).toBe(THINKING_STAGES[0]);
  expect(thinkingStageAt(Number.NaN)).toBe(THINKING_STAGES[0]);
});

test("단계 문구는 비어 있지 않고 서로 겹치지 않는다", () => {
  expect(THINKING_STAGES.length).toBeGreaterThanOrEqual(4);
  for (const stage of THINKING_STAGES) expect(stage.trim()).not.toBe("");
  expect(new Set(THINKING_STAGES).size).toBe(THINKING_STAGES.length);
});
