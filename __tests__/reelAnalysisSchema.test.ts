import { ReelAnalysisSchema, ReelSchema, PRINCIPLE_IDS } from "@/lib/schemas";

const VALID = {
  summary: "통념을 부정해 붙잡고 실패담으로 신뢰를 만든다.",
  idea: {
    coreIdea: "구조가 매출을 만든다",
    valueProposition: "시간을 줄이며 매출을 올린다",
    targetAudience: "초기 1인 창업가",
    differentiator: "실패 기간을 먼저 꺼낸다",
  },
  hook: {
    line: "월 천만원 버는 사람은 이걸 안 합니다",
    type: "contrarian",
    template: "[목표 달성한 사람]은 [흔한 행동]을 안 합니다",
    why: "통념을 부정해 확인 욕구를 만든다",
  },
  story: {
    formatId: "heros-journey",
    confidence: "high",
    rationale: "문제 → 실패한 시도 → 해법 → 결과 순서가 그대로 나타난다",
    beats: [
      { beatId: "intro", present: true, startSec: 0, endSec: 3, summary: "문제 제시" },
      { beatId: "rising-action", present: false, summary: "실패한 시도가 없다" },
    ],
    secretSauceMet: "본인의 통증을 먼저 꺼내 공감을 만든다",
    secretSauceMissed: "실패 과정이 없어 해법이 쉬워 보인다",
  },
  principles: PRINCIPLE_IDS.map((id) => ({
    id,
    score: 3,
    evidence: "근거 문장",
    fix: "고칠 방법",
  })),
};

test("포맷 id는 카탈로그에 있는 값만 받는다", () => {
  expect(ReelAnalysisSchema.parse(VALID).story.formatId).toBe("heros-journey");

  const unknown = { ...VALID, story: { ...VALID.story, formatId: "made-up-format" } };
  expect(() => ReelAnalysisSchema.parse(unknown)).toThrow();
});

test("원리 점수는 1~5 정수만 받는다", () => {
  const tooHigh = {
    ...VALID,
    principles: VALID.principles.map((p, i) => (i === 0 ? { ...p, score: 9 } : p)),
  };
  expect(() => ReelAnalysisSchema.parse(tooHigh)).toThrow();
});

test("원리 8개가 모두 있어야 한다", () => {
  const missing = { ...VALID, principles: VALID.principles.slice(0, 5) };
  expect(() => ReelAnalysisSchema.parse(missing)).toThrow();
});

test("빠진 비트도 present false로 기록한다", () => {
  const parsed = ReelAnalysisSchema.parse(VALID);
  const missing = parsed.story.beats.filter((beat) => !beat.present);

  expect(missing).toHaveLength(1);
  expect(missing[0].beatId).toBe("rising-action");
});

test("예전 구조로 캐시된 분석은 릴스 로딩을 깨지 않고 버려진다", () => {
  // 스키마를 바꾸기 전에 저장된 분석이 남아 있으면, 그 릴스 전체가 파싱에
  // 실패해 대시보드가 통째로 빈다. 분석만 조용히 떨어뜨리고 릴스는 살린다.
  const reel = ReelSchema.parse({
    id: "r1",
    postedAt: "2026-06-01T00:00:00Z",
    durationSec: 30,
    views: 10,
    reach: 9,
    likes: 1,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 5,
    reelAnalysis: { summary: "예전 구조", story: { format: "문제 → 반전", beats: [] } },
  });

  expect(reel.id).toBe("r1");
  expect(reel.reelAnalysis).toBeUndefined();
});
