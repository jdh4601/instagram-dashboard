import { expect, test } from "vitest";
import {
  buildImprovedStoryPrompt,
  parseImprovedStory,
} from "@/lib/recommend/improvedStory";
import { PRINCIPLE_IDS, type Reel, type ReelAnalysis } from "@/lib/schemas";

function reel(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "r1",
    postedAt: "2026-06-01T00:00:00Z",
    durationSec: 30,
    views: 12000,
    reach: 9000,
    likes: 300,
    comments: 40,
    saves: 120,
    shares: 60,
    avgWatchTimeSec: 12,
    transcript: [
      { startSec: 0, endSec: 3, text: "이 브랜드가 성공한 이유는 디자인이 아닙니다" },
      { startSec: 3, endSec: 12, text: "핵심은 스토리텔링입니다" },
    ],
    ...overrides,
  };
}

// 어바웃 미 포맷의 비트 id: intro, conflict, epiphany, change, purpose (전부 필수)
function analysis(overrides: Partial<ReelAnalysis["story"]> = {}): ReelAnalysis {
  return {
    summary: "요약",
    idea: {
      coreIdea: "핵심",
      valueProposition: "가치",
      targetAudience: "타깃",
      differentiator: "차별점",
    },
    hook: {
      line: "이 브랜드가 성공한 이유는 디자인이 아닙니다",
      type: "contrarian",
      template: "[결과]의 이유는 [예상되는 것]이 아닙니다",
      why: "통념을 부정한다",
    },
    story: {
      formatId: "about-me",
      confidence: "medium",
      rationale: "오리진 스토리 구조",
      beats: [
        { beatId: "intro", present: true, startSec: 0, endSec: 3, summary: "출발점" },
        { beatId: "epiphany", present: false, summary: "깨달음이 없다" },
      ],
      secretSauceMet: "배경을 먼저 세운다",
      secretSauceMissed: "관점이 바뀌는 순간이 없다",
      ...overrides,
    },
    principles: PRINCIPLE_IDS.map((id) => ({ id, score: 3, evidence: "근거", fix: "개선안" })),
  };
}

function payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    formatId: "about-me",
    premise: "깨달음 비트를 세워 감정 연결을 만든다",
    beats: [
      { beatId: "intro", line: "고등학교를 자퇴했습니다.", startSec: 0, endSec: 3, origin: "rewritten", note: "인물부터 세운다" },
      { beatId: "conflict", line: "그때 옷 하나로 버텼습니다.", startSec: 3, endSec: 8, origin: "added", note: "계기를 만든다" },
      { beatId: "epiphany", line: "옷이 아니라 감정을 판다는 걸 알았습니다.", startSec: 8, endSec: 14, origin: "added", note: "빠진 비트를 채운다" },
      { beatId: "change", line: "500명의 크리에이터에게 후드를 보냈습니다.", startSec: 14, endSec: 22, origin: "kept", note: "그대로 둔다" },
      { beatId: "purpose", line: "지금은 연매출 1조를 봅니다.", startSec: 22, endSec: 30, origin: "kept", note: "결과로 닫는다" },
    ],
    changes: ["깨달음 비트를 새로 넣었다", "결과를 뒤로 옮겼다"],
    ...overrides,
  });
}

test("프롬프트는 유지할 포맷의 비트 시퀀스를 그대로 싣는다", () => {
  const { userText } = buildImprovedStoryPrompt(reel(), analysis());

  expect(userText).toContain("어바웃 미");
  expect(userText).toContain("epiphany");
  // 포맷을 바꾸지 말라는 계약이 프롬프트에 있어야 한다.
  expect(userText).toContain("about-me");
});

test("프롬프트는 빠진 비트를 짚어 준다", () => {
  const { userText } = buildImprovedStoryPrompt(reel(), analysis());

  expect(userText).toContain("깨달음이 없다");
});

test("코드펜스에 싸여 와도 읽어 낸다", () => {
  const fenced = "```json\n" + payload() + "\n```";

  const improved = parseImprovedStory(fenced, analysis(), reel());

  expect(improved.formatId).toBe("about-me");
  expect(improved.beats).toHaveLength(5);
});

test("분석이 고른 포맷을 바꿔 오면 막는다", () => {
  const swapped = payload({ formatId: "heros-journey" });

  // 포맷 유지가 이 기능의 계약이다. 바꿔 오면 화면이 다른 비트 라벨을 찾게 된다.
  expect(() => parseImprovedStory(swapped, analysis(), reel())).toThrow(/포맷/);
});

test("그 포맷에 없는 비트 id는 막는다", () => {
  const stray = payload({
    beats: [
      { beatId: "climax", line: "문장", startSec: 0, endSec: 5, origin: "added", note: "설명" },
    ],
  });

  expect(() => parseImprovedStory(stray, analysis(), reel())).toThrow(/비트 id/);
});

test("필수 비트가 빠지면 막는다", () => {
  const partial = payload({
    beats: [
      { beatId: "intro", line: "문장", startSec: 0, endSec: 5, origin: "kept", note: "설명" },
    ],
  });

  expect(() => parseImprovedStory(partial, analysis(), reel())).toThrow(/빠졌습니다/);
});

test("타임코드가 뒤로 가면 막는다", () => {
  const backwards = JSON.parse(payload()) as { beats: { startSec: number; endSec: number }[] };
  backwards.beats[2].startSec = 2;

  expect(() => parseImprovedStory(JSON.stringify(backwards), analysis(), reel())).toThrow(
    /타임코드/,
  );
});

test("영상 길이를 넘는 타임코드는 막는다", () => {
  const overrun = JSON.parse(payload()) as { beats: { startSec: number; endSec: number }[] };
  overrun.beats[4].endSec = 45;

  expect(() => parseImprovedStory(JSON.stringify(overrun), analysis(), reel())).toThrow(
    /영상 길이/,
  );
});
