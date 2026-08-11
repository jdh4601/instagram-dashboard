import {
  DEFAULT_TAB_ID,
  REEL_ANALYSIS_TABS,
  isActiveTab,
  resolveTabId,
  tabNeedsLlmAnalysis,
} from "@/lib/ui/reelAnalysisTabs";

test("탭은 Transcript · Idea Analysis · Hook · Storytelling Format 4개다", () => {
  expect(REEL_ANALYSIS_TABS.map((t) => t.id)).toEqual([
    "transcript",
    "idea",
    "hook",
    "story",
  ]);
  expect(REEL_ANALYSIS_TABS.map((t) => t.label)).toEqual([
    "Transcript",
    "Idea Analysis",
    "Hook",
    "Storytelling Format",
  ]);
});

test("기본 탭은 자막 전문이다", () => {
  // 자막만 있으면 LLM 없이 바로 볼 수 있는 유일한 탭이라 첫 화면으로 적합하다.
  expect(DEFAULT_TAB_ID).toBe("transcript");
});

test("아는 탭 id는 그대로 통과시킨다", () => {
  expect(resolveTabId("hook")).toBe("hook");
  expect(resolveTabId("story")).toBe("story");
});

test("모르는 값은 기본 탭으로 되돌린다", () => {
  expect(resolveTabId("visual-layout")).toBe(DEFAULT_TAB_ID);
  expect(resolveTabId(null)).toBe(DEFAULT_TAB_ID);
  expect(resolveTabId(undefined)).toBe(DEFAULT_TAB_ID);
  expect(resolveTabId("")).toBe(DEFAULT_TAB_ID);
});

test("활성 탭 판정은 id가 같을 때만 참이다", () => {
  expect(isActiveTab("hook", "hook")).toBe(true);
  expect(isActiveTab("hook", "idea")).toBe(false);
});

test("자막 탭만 LLM 없이 볼 수 있다", () => {
  expect(tabNeedsLlmAnalysis("transcript")).toBe(false);
  expect(tabNeedsLlmAnalysis("idea")).toBe(true);
  expect(tabNeedsLlmAnalysis("hook")).toBe(true);
  expect(tabNeedsLlmAnalysis("story")).toBe(true);
});
