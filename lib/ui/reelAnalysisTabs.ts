export const REEL_ANALYSIS_TABS = [
  { id: "transcript", label: "Transcript" },
  { id: "idea", label: "Idea Analysis" },
  { id: "hook", label: "Hook" },
  { id: "story", label: "Storytelling Format" },
] as const;

export type ReelAnalysisTabId = (typeof REEL_ANALYSIS_TABS)[number]["id"];

/** 자막만 있으면 LLM 없이 바로 볼 수 있는 유일한 탭이라 첫 화면으로 삼는다. */
export const DEFAULT_TAB_ID: ReelAnalysisTabId = "transcript";

/**
 * 바깥에서 들어온 탭 값(쿼리스트링·저장된 상태)을 아는 id로 좁힌다.
 *
 * 범위 밖으로 미뤄 둔 Visual Layout 링크가 아직 돌아다닐 수 있어서, 모르는 값은
 * 빈 화면 대신 기본 탭으로 되돌린다.
 */
export function resolveTabId(value: string | null | undefined): ReelAnalysisTabId {
  const known = REEL_ANALYSIS_TABS.find((tab) => tab.id === value);
  return known ? known.id : DEFAULT_TAB_ID;
}

export function isActiveTab(current: ReelAnalysisTabId, candidate: ReelAnalysisTabId): boolean {
  return current === candidate;
}

export function tabNeedsLlmAnalysis(id: ReelAnalysisTabId): boolean {
  return id !== "transcript";
}
