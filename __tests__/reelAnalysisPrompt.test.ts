import {
  buildReelAnalysisPrompt,
  generateReelAnalysis,
  parseReelAnalysis,
} from "@/lib/recommend/reelAnalysis";
import { PRINCIPLE_IDS, type Reel } from "@/lib/schemas";

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
  summary: "훅은 강했지만 중반 전환이 늦어 이탈이 났다.",
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
    formatId: "heros-journey",
    confidence: "high",
    rationale: "문제 → 실패 → 해법 순서가 그대로 나타난다",
    beats: [
      { beatId: "intro", present: true, startSec: 0, endSec: 2.5, summary: "문제 제기", quote: "이걸 안 합니다" },
      { beatId: "inflection-point", present: true, startSec: 2.5, endSec: 10, summary: "통증" },
      { beatId: "rising-action", present: false, summary: "실패한 시도가 통째로 없다" },
      { beatId: "climax", present: false, summary: "해법을 밝히지 않는다" },
      { beatId: "falling-action", present: false, summary: "결과 증명이 없다" },
      { beatId: "resolution", present: true, startSec: 30, endSec: 40, summary: "링크 안내" },
    ],
    secretSauceMet: "본인의 통증을 먼저 꺼내 공감을 만든다",
    secretSauceMissed: "실패 과정이 없어 해법의 무게가 실리지 않는다",
  },
  principles: PRINCIPLE_IDS.map((id) => ({
    id,
    score: 3,
    evidence: `${id} 근거`,
    fix: `${id} 개선안`,
  })),
});

test("프롬프트에 자막을 시각과 함께 싣는다", () => {
  const { userText } = buildReelAnalysisPrompt(reel());

  expect(userText).toContain("월 천만원 버는 1인 창업가는 이걸 안 합니다");
  expect(userText).toContain("[0-2.5s]");
});

test("프롬프트는 10개 포맷 카탈로그를 후보로 실어 준다", () => {
  const { userText, system } = buildReelAnalysisPrompt(reel());
  const whole = `${system}\n${userText}`;

  // 모델이 포맷 id를 지어내면 스키마에서 걸린다. 후보를 미리 보여 준다.
  expect(whole).toContain("heros-journey");
  expect(whole).toContain("before-after");
  expect(whole).toContain("lesson-from-others");
});

test("프롬프트에 자막에서 잰 객관 수치가 들어간다", () => {
  const { userText } = buildReelAnalysisPrompt(reel());

  // 인상이 아니라 수치를 근거로 삼게 한다.
  expect(userText).toContain("초당");
  expect(userText).toContain("짧은 문장");
  expect(userText).toContain("훅 구간");
});

test("프롬프트는 8가지 원리를 모두 이름으로 요구한다", () => {
  const { system } = buildReelAnalysisPrompt(reel());

  for (const id of PRINCIPLE_IDS) {
    expect(system).toContain(id);
  }
});

test("자막이 없으면 프롬프트를 만들지 않고 던진다", () => {
  expect(() => buildReelAnalysisPrompt(reel({ transcript: [] }))).toThrow(/자막/);
  expect(() => buildReelAnalysisPrompt(reel({ transcript: undefined }))).toThrow(/자막/);
});

test("모델 응답을 스키마로 검증해 파싱한다", () => {
  const parsed = parseReelAnalysis(VALID_RESPONSE);

  expect(parsed.story.formatId).toBe("heros-journey");
  expect(parsed.story.beats.filter((b) => !b.present)).toHaveLength(3);
  expect(parsed.principles).toHaveLength(8);
});

test("코드펜스로 감싼 응답도 읽어낸다", () => {
  const fenced = "```json\n" + VALID_RESPONSE + "\n```";
  expect(parseReelAnalysis(fenced).summary).toContain("훅은 강했지만");
});

test("카탈로그에 없는 비트 id는 조용히 넘어가지 않고 던진다", () => {
  const body = JSON.parse(VALID_RESPONSE);
  const strayBeat = JSON.stringify({
    ...body,
    story: { ...body.story, beats: [{ beatId: "made-up-beat", present: true, summary: "x" }] },
  });

  // 포맷에 없는 비트를 통과시키면 화면이 라벨을 못 찾아 빈칸이 된다.
  expect(() => parseReelAnalysis(strayBeat)).toThrow(/비트/);
});

test("스키마와 어긋난 응답은 조용히 넘어가지 않고 던진다", () => {
  const body = JSON.parse(VALID_RESPONSE);

  expect(() => parseReelAnalysis(JSON.stringify({ ...body, hook: undefined }))).toThrow();
  expect(() =>
    parseReelAnalysis(JSON.stringify({ ...body, principles: body.principles.slice(0, 3) })),
  ).toThrow();
});

test("JSON이 아예 없는 응답은 무엇이 틀렸는지 알려준다", () => {
  expect(() => parseReelAnalysis("죄송하지만 분석할 수 없습니다")).toThrow(/JSON/);
});

test("모델을 호출해 검증된 분석을 돌려준다", async () => {
  const model = { generate: vi.fn(async () => VALID_RESPONSE) };

  const result = await generateReelAnalysis(reel(), model);

  expect(result.hook.template).toContain("[흔한 행동]");
  expect(result.story.confidence).toBe("high");
  expect(model.generate).toHaveBeenCalledTimes(1);
});
