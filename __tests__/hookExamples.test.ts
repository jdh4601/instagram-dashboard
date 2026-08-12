import { groupHookExamplesByType } from "@/lib/ui/hookExamples";
import { HOOK_TYPES } from "@/lib/schemas/reelAnalysis";
import type { Reel, ReelAnalysis } from "@/lib/schemas";

function analysis(overrides: Partial<ReelAnalysis["hook"]>): ReelAnalysis {
  return {
    summary: "요약",
    idea: {
      coreIdea: "핵심",
      valueProposition: "가치",
      targetAudience: "대상",
      differentiator: "차별점",
    },
    hook: {
      line: "3초 안에 나온 문장",
      type: "problem",
      template: "[문제]를 겪고 있다면",
      why: "통증을 먼저 세워서",
      ...overrides,
    },
    story: {
      formatId: "heros-journey",
      confidence: "high",
      rationale: "이유",
      beats: [{ beatId: "intro", present: true, summary: "도입" }],
      secretSauceMet: "지킴",
      secretSauceMissed: "놓침",
    },
    principles: [],
  } as ReelAnalysis;
}

function reel(id: string, overrides: Partial<Reel> = {}): Reel {
  return {
    id,
    postedAt: "2026-06-01T00:00:00Z",
    durationSec: 30,
    views: 1000,
    reach: 800,
    likes: 20,
    comments: 2,
    saves: 10,
    shares: 8,
    avgWatchTimeSec: 12,
    ...overrides,
  };
}

test("분석된 릴스의 훅을 유형별로 묶는다", () => {
  const grouped = groupHookExamplesByType([
    reel("a", { caption: "첫 릴스", reelAnalysis: analysis({ type: "problem" }) }),
    reel("b", { caption: "둘째 릴스", reelAnalysis: analysis({ type: "contrarian" }) }),
  ]);

  expect(grouped.problem.map((example) => example.reelId)).toEqual(["a"]);
  expect(grouped.contrarian.map((example) => example.reelId)).toEqual(["b"]);
  expect(grouped.problem[0].reelTitle).toBe("첫 릴스");
  expect(grouped.problem[0].line).toBe("3초 안에 나온 문장");
});

test("분석이 없는 릴스는 건너뛰고 모든 유형 칸은 만들어 둔다", () => {
  const grouped = groupHookExamplesByType([reel("a"), reel("b")]);

  for (const type of HOOK_TYPES) {
    expect(grouped[type]).toEqual([]);
  }
});

test("같은 유형은 최신 게시물이 먼저 온다", () => {
  const grouped = groupHookExamplesByType([
    reel("old", { postedAt: "2026-01-01T00:00:00Z", reelAnalysis: analysis({ type: "curiosity" }) }),
    reel("new", { postedAt: "2026-07-01T00:00:00Z", reelAnalysis: analysis({ type: "curiosity" }) }),
  ]);

  expect(grouped.curiosity.map((example) => example.reelId)).toEqual(["new", "old"]);
});
