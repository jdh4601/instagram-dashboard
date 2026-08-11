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
