import { DEFAULT_TAB_ID, REEL_ANALYSIS_TABS } from "@/lib/ui/reelAnalysisTabs";

test("탭은 Transcript · Idea Analysis · Hook · Storytelling Format · Improved Story 5개다", () => {
  // Improved Story는 Storytelling Format이 짚은 빠진 비트를 채우는 자리라 그 뒤에 온다.
  expect(REEL_ANALYSIS_TABS.map((t) => t.id)).toEqual([
    "transcript",
    "idea",
    "hook",
    "story",
    "improved",
  ]);
  expect(REEL_ANALYSIS_TABS.map((t) => t.label)).toEqual([
    "Transcript",
    "Idea Analysis",
    "Hook",
    "Storytelling Format",
    "Improved Story",
  ]);
});

test("기본 탭은 자막 전문이다", () => {
  // 자막만 있으면 LLM 없이 바로 볼 수 있는 유일한 탭이라 첫 화면으로 적합하다.
  expect(DEFAULT_TAB_ID).toBe("transcript");
});
