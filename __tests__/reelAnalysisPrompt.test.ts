import {
  buildReelAnalysisPrompt,
  generateReelAnalysis,
  parseReelAnalysis,
} from "@/lib/recommend/reelAnalysis";
import type { Reel } from "@/lib/schemas";

function reel(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "r1",
    postedAt: "2026-06-01T00:00:00Z",
    durationSec: 40,
    views: 12000,
    reach: 9000,
    likes: 300,
    comments: 40,
    saves: 120,
    shares: 60,
    avgWatchTimeSec: 18,
    caption: "1인 창업가 이야기",
    transcript: [
      { startSec: 0, endSec: 2.5, text: "월 천만원 버는 1인 창업가는 이걸 안 합니다" },
      { startSec: 2.5, endSec: 10, text: "저도 처음엔 매일 12시간씩 일했어요" },
      { startSec: 10, endSec: 30, text: "그런데 매출은 그대로였습니다" },
      { startSec: 30, endSec: 40, text: "지금 프로필 링크에서 확인해 보세요" },
    ],
    ...overrides,
  };
}

const VALID_RESPONSE = JSON.stringify({
  summary: "훅은 강했지만 중반 전환이 늦어 이탈이 났다. 마무리 CTA는 저장으로 이어졌다.",
  idea: {
    coreIdea: "노동 시간이 아니라 구조가 매출을 만든다",
    valueProposition: "일하는 시간을 줄이면서 매출을 올리는 기준을 얻는다",
    targetAudience: "혼자 일하며 시간이 부족한 초기 1인 창업가",
    differentiator: "성공담이 아니라 본인의 실패 기간을 먼저 꺼낸다",
  },
  hook: {
    line: "월 천만원 버는 1인 창업가는 이걸 안 합니다",
    type: "contrarian",
    template: "[목표 달성한 사람]은 [흔한 행동]을 안 합니다",
    why: "통념을 부정해 확인 욕구를 만든다",
  },
  story: {
    format: "통념 부정 → 개인 경험 → 반전 → 제안",
    beats: [
      { stage: "intro", label: "통념 부정", startSec: 0, endSec: 2.5, summary: "훅", quote: "이걸 안 합니다" },
      { stage: "development", label: "경험 공유", startSec: 2.5, endSec: 10, summary: "본인 사례" },
      { stage: "turn", label: "반전", startSec: 10, endSec: 30, summary: "결과가 없었다" },
      { stage: "closing", label: "행동 유도", startSec: 30, endSec: 40, summary: "링크 안내" },
    ],
  },
});

test("프롬프트에 자막을 시각과 함께 싣는다", () => {
  const { userText } = buildReelAnalysisPrompt(reel());

  expect(userText).toContain("월 천만원 버는 1인 창업가는 이걸 안 합니다");
  expect(userText).toContain("[0-2.5s]");
});

test("프롬프트는 탭 4개를 한 번에 요구한다", () => {
  const { system } = buildReelAnalysisPrompt(reel());

  // 탭마다 호출하면 같은 자막을 네 번 보내 비용이 4배가 된다.
  for (const key of ["summary", "idea", "hook", "story"]) {
    expect(system).toContain(key);
  }
});

test("자막이 없으면 프롬프트를 만들지 않고 던진다", () => {
  expect(() => buildReelAnalysisPrompt(reel({ transcript: [] }))).toThrow(/자막/);
  expect(() => buildReelAnalysisPrompt(reel({ transcript: undefined }))).toThrow(/자막/);
});

test("모델 응답을 스키마로 검증해 파싱한다", () => {
  const parsed = parseReelAnalysis(VALID_RESPONSE);

  expect(parsed.hook.type).toBe("contrarian");
  expect(parsed.story.beats).toHaveLength(4);
  expect(parsed.idea.targetAudience).toContain("1인 창업가");
});

test("코드펜스로 감싼 응답도 읽어낸다", () => {
  const fenced = "```json\n" + VALID_RESPONSE + "\n```";
  expect(parseReelAnalysis(fenced).summary).toContain("훅은 강했지만");
});

test("스키마와 어긋난 응답은 조용히 넘어가지 않고 던진다", () => {
  const missingHook = JSON.stringify({ ...JSON.parse(VALID_RESPONSE), hook: undefined });
  expect(() => parseReelAnalysis(missingHook)).toThrow();

  const unknownHookType = JSON.stringify({
    ...JSON.parse(VALID_RESPONSE),
    hook: { ...JSON.parse(VALID_RESPONSE).hook, type: "아무거나" },
  });
  expect(() => parseReelAnalysis(unknownHookType)).toThrow();

  const emptyBeats = JSON.stringify({
    ...JSON.parse(VALID_RESPONSE),
    story: { format: "x", beats: [] },
  });
  expect(() => parseReelAnalysis(emptyBeats)).toThrow();
});

test("JSON이 아예 없는 응답은 무엇이 틀렸는지 알려준다", () => {
  expect(() => parseReelAnalysis("죄송하지만 분석할 수 없습니다")).toThrow(/JSON/);
});

test("모델을 호출해 검증된 분석을 돌려준다", async () => {
  const model = { generate: vi.fn(async () => VALID_RESPONSE) };

  const result = await generateReelAnalysis(reel(), model);

  expect(result.hook.template).toContain("[흔한 행동]");
  expect(model.generate).toHaveBeenCalledTimes(1);
});
