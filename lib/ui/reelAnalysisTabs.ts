export const REEL_ANALYSIS_TABS = [
  { id: "transcript", label: "Transcript" },
  { id: "idea", label: "Idea Analysis" },
  { id: "hook", label: "Hook" },
  { id: "story", label: "Storytelling Format" },
  // 앞 탭이 짚은 빠진 비트를 실제 문장으로 채우는 자리라 맨 뒤에 둔다.
  { id: "improved", label: "Improved Story" },
] as const;

export type ReelAnalysisTabId = (typeof REEL_ANALYSIS_TABS)[number]["id"];

/** 자막만 있으면 LLM 없이 바로 볼 수 있는 유일한 탭이라 첫 화면으로 삼는다. */
export const DEFAULT_TAB_ID: ReelAnalysisTabId = "transcript";
