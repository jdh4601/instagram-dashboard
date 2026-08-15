import { renderToStaticMarkup } from "react-dom/server";
import { ChatMessages } from "@/components/chat/ChatMessages";
import type { ChatMessage } from "@/components/chat/useChat";
import { THINKING_STAGES } from "@/lib/ui/thinkingStatus";

const CREATED_AT = "2026-07-31T12:00:00.000Z";

function render(content: string) {
  const messages: ChatMessage[] = [{ role: "assistant", content, createdAt: CREATED_AT }];
  return renderToStaticMarkup(<ChatMessages messages={messages} streaming={null} error={null} />);
}

test("강점은 초록 카드로 보여준다", () => {
  const html = render("[강점] 프로필 전환 :: 방문률이 기준을 넘습니다");

  expect(html).toContain("band-strong-soft");
  expect(html).toContain("band-strong-border");
  expect(html).toContain("프로필 전환");
  expect(html).toContain("방문률이 기준을 넘습니다");
});

test("약점은 빨강 카드로 보여준다", () => {
  const html = render("[약점] 훅 이탈 :: 3초 잔존이 낮습니다");

  expect(html).toContain("band-weak-soft");
  expect(html).toContain("band-weak-border");
  expect(html).toContain("훅 이탈");
});

test("지표 행은 값과 기준을 함께 보여주고 미달이면 빨강으로 칠한다", () => {
  const html = render("[지표] 3초 훅 잔존 | 37.33% | 45");

  expect(html).toContain("3초 훅 잔존");
  expect(html).toContain("37.33%");
  expect(html).toContain("45");
  expect(html).toContain("text-band-weak");
});

test("기준을 넘긴 지표는 초록으로 칠한다", () => {
  expect(render("[지표] 방문률 | 13.04% | 10")).toContain("text-band-strong");
});

test("증감 수치는 방향에 따라 색이 갈린다", () => {
  expect(render("팔로워 +9.3%")).toContain("text-band-strong");
  expect(render("도달 −9.7%")).toContain("text-band-weak");
});

test("약점 카드가 대조로 인용한 좋은 수치까지 빨갛게 칠하지 않는다", () => {
  // 부호 없는 수치는 굵기만 받는다. 카드 색을 물려주면 "캐러셀은 0.73%가 나온다"처럼
  // 잘되고 있다는 근거가 약점 색으로 표시돼 판정이 뒤집혀 읽힌다.
  const html = render("[약점] 저장 :: 릴스는 0.26%인데 캐러셀은 0.73%가 나옵니다");

  expect(html).toContain('<span class="font-semibold tabular-nums">0.73%</span>');
  expect(html).toContain('<span class="font-semibold tabular-nums">0.26%</span>');
});

test("태그 없는 답변은 지금까지처럼 문단으로 렌더링한다", () => {
  const html = render("최근 2주 성과의 병목은 저장·훅에서 새는 릴스입니다.");

  expect(html).toContain("최근 2주 성과의 병목은 저장·훅에서 새는 릴스입니다.");
  expect(html).not.toContain("band-strong-soft");
  expect(html).not.toContain("band-weak-soft");
});

test("모델 출력에 든 마크업은 글자로만 남는다", () => {
  const html = render("[강점] <script>alert(1)</script> :: <img src=x>");

  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x>");
});

test("사용자 메시지는 말풍선으로 남는다", () => {
  const messages: ChatMessage[] = [
    { role: "user", content: "최근 2주 성과를 진단해줘", createdAt: CREATED_AT },
  ];
  const html = renderToStaticMarkup(
    <ChatMessages messages={messages} streaming={null} error={null} />,
  );

  expect(html).toContain("최근 2주 성과를 진단해줘");
  expect(html).toContain("bg-brand-600");
});

/**
 * 응답을 기다리는 동안 진행 표시가 실제로 붙는지 확인한다. 단계 전환은 타이머가 하지만
 * (chatThinkingStatus.test.ts), 이 배선이 빠지면 사용자에게는 빈 화면만 남는다.
 */
test("첫 토큰 전에는 진행 표시를 보여준다", () => {
  const html = renderToStaticMarkup(<ChatMessages messages={[]} streaming="" error={null} />);

  expect(html).toContain(THINKING_STAGES[0]);
  expect(html).toContain('role="status"');
  expect(html).toContain("thinking-dot");
});

test("델타가 도착하면 진행 표시를 걷고 본문을 그린다", () => {
  const html = renderToStaticMarkup(
    <ChatMessages messages={[]} streaming="병목은 저장에서" error={null} />,
  );

  expect(html).toContain("병목은 저장에서");
  expect(html).not.toContain("thinking-dot");
});
