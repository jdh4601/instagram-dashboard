import { buildChatSystemPrompt, selectContextTurns, MAX_CONTEXT_TURNS } from "@/lib/chat/prompt";
import type { ChatTurn } from "@/lib/llm/types";
import type { Reel } from "@/lib/schemas";

const CONTEXT = "[계정]\n- 사용자명: @tester";

function reel(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "reel-1",
    postedAt: "2026-07-20T09:00:00Z",
    durationSec: 30,
    views: 1000,
    reach: 800,
    likes: 20,
    comments: 2,
    saves: 4,
    shares: 6,
    avgWatchTimeSec: 10,
    caption: "가격 정하는 법",
    ...overrides,
  };
}

function analysis(): NonNullable<Reel["reelAnalysis"]> {
  return {
    summary: "가격 이야기를 30초에 담은 릴스",
    idea: {
      coreIdea: "가격은 원가가 아니라 인식으로 정해진다",
      valueProposition: "값을 올려도 문의가 줄지 않는 기준을 얻는다",
      targetAudience: "이제 막 값을 매기는 1인 사업자",
      differentiator: "실제 견적서를 화면에 띄워 보여 준다",
    },
    hook: {
      line: "원가로 가격 정하지 마세요",
      type: "contrarian",
      template: "[모두가 하는 것]으로 [대상]을 정하지 마세요",
      why: "다들 원가 기준으로 배웠기 때문에 첫 문장에서 기대가 깨진다",
    },
    story: {
      formatId: "before-after",
      confidence: "medium",
      rationale: "가격 전후를 대비시키는 전개다",
      beats: [
        { beatId: "hook", present: true, startSec: 0, endSec: 3, summary: "원가 기준을 부정" },
        { beatId: "after-state", present: false, summary: "올린 뒤의 결과를 보여 주지 않았다" },
      ],
      secretSauceMet: "전후 대비가 화면에 그대로 보인다",
      secretSauceMissed: "애프터의 수치가 없다",
    },
    principles: [
      { id: "curiosity-contrast", score: 4, evidence: "첫 문장이 통념을 뒤집는다", fix: "유지" },
      { id: "speed-to-value", score: 2, evidence: "본론이 12초에 나온다", fix: "배경 설명을 잘라낸다" },
      { id: "value-density", score: 3, evidence: "핵심이 두 개뿐", fix: "사례를 하나 더" },
      { id: "clarity", score: 4, evidence: "용어가 쉽다", fix: "유지" },
      { id: "absorption", score: 3, evidence: "자막이 촘촘하다", fix: "화면 전환 추가" },
      { id: "anticipation", score: 2, evidence: "다음을 궁금하게 만드는 문장이 없다", fix: "예고 한 줄" },
      { id: "emotional-resonance", score: 3, evidence: "경험담이 짧다", fix: "실패 장면을 붙인다" },
      { id: "rhythm", score: 3, evidence: "속도가 일정하다", fix: "중간에 멈춤을 넣는다" },
    ],
  };
}

test("system 프롬프트에 계정 컨텍스트가 그대로 실린다", () => {
  const prompt = buildChatSystemPrompt(CONTEXT, []);
  expect(prompt).toContain(CONTEXT);
});

test("system 프롬프트가 근거 없는 단정을 금지한다", () => {
  const prompt = buildChatSystemPrompt(CONTEXT, []);
  expect(prompt).toContain("데이터가 부족하면");
});

test("system 프롬프트가 카드·지표 표기법을 알려준다", () => {
  const prompt = buildChatSystemPrompt(CONTEXT, []);

  // 파서가 실제로 읽는 태그와 어긋나면 화면이 줄글로 되돌아간다.
  expect(prompt).toContain("[강점]");
  expect(prompt).toContain("[약점]");
  expect(prompt).toContain("[지표]");
  expect(prompt).toContain("::");
});

test("지목된 게시물이 있으면 자막까지 덧붙인다", () => {
  const prompt = buildChatSystemPrompt(CONTEXT, [
    reel({
      transcript: [{ startSec: 0, endSec: 2, text: "첫 두 초에 이걸 말합니다" }],
    }),
  ]);

  expect(prompt).toContain("지목한 게시물 상세");
  expect(prompt).toContain("첫 두 초에 이걸 말합니다");
});

test("지목된 게시물이 없으면 상세 섹션 자체가 없다", () => {
  expect(buildChatSystemPrompt(CONTEXT, [])).not.toContain("지목한 게시물 상세");
});

test("지목된 게시물의 대본 분석(훅·포맷·원리)을 프롬프트에 싣는다", () => {
  const prompt = buildChatSystemPrompt(CONTEXT, [reel({ reelAnalysis: analysis() })]);

  // 요약과 아이디어
  expect(prompt).toContain("가격 이야기를 30초에 담은 릴스");
  expect(prompt).toContain("가격은 원가가 아니라 인식으로 정해진다");
  expect(prompt).toContain("이제 막 값을 매기는 1인 사업자");

  // 훅 — 유형은 내부 id가 아니라 화면과 같은 한국어 라벨로 실린다.
  expect(prompt).toContain("역발상");
  expect(prompt).not.toContain("contrarian");
  expect(prompt).toContain("원가로 가격 정하지 마세요");

  // 스토리 포맷과 비트 — 빠진 비트를 짚을 수 있어야 한다.
  expect(prompt).toContain("비포 애프터");
  expect(prompt).toContain("빠짐");

  // 8원리 점수
  expect(prompt).toContain("가치까지의 속도");
  expect(prompt).toContain("2/5");
});

test("대본 분석이 없는 게시물에는 분석 섹션이 붙지 않는다", () => {
  // 답변 규칙에도 "[대본 분석]"이라는 말이 나오므로 섹션 머리표로 확인한다.
  const prompt = buildChatSystemPrompt(CONTEXT, [reel()]);
  expect(prompt).not.toContain("  대본 분석:");
  expect(prompt).not.toContain("스크립트 원리 점수");
});

test("개선 전개안이 있으면 함께 싣는다", () => {
  const prompt = buildChatSystemPrompt(CONTEXT, [
    reel({
      improvedStory: {
        formatId: "before-after",
        hookType: "curiosity",
        premise: "결과를 먼저 보여 주고 방법을 나중에 푼다",
        beats: [
          {
            beatId: "hook",
            line: "가격을 두 배로 올렸더니 문의가 늘었습니다",
            startSec: 0,
            endSec: 3,
            origin: "rewritten",
            note: "원가 이야기를 결과로 바꿔 3초 안에 대비를 만든다",
          },
        ],
      },
    }),
  ]);

  expect(prompt).toContain("개선 전개안");
  expect(prompt).toContain("가격을 두 배로 올렸더니 문의가 늘었습니다");
});

test(`모델에는 최근 ${MAX_CONTEXT_TURNS}턴만 보낸다`, () => {
  const turns: ChatTurn[] = Array.from({ length: MAX_CONTEXT_TURNS + 8 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `턴 ${i}`,
  }));

  const selected = selectContextTurns(turns);
  expect(selected).toHaveLength(MAX_CONTEXT_TURNS);
  // 잘려 나가는 쪽은 오래된 앞부분이어야 한다.
  expect(selected.at(-1)!.content).toBe(`턴 ${turns.length - 1}`);
});

test("턴이 적으면 그대로 전달한다", () => {
  const turns: ChatTurn[] = [{ role: "user", content: "안녕" }];
  expect(selectContextTurns(turns)).toEqual(turns);
});
