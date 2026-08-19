import { renderToStaticMarkup } from "react-dom/server";
import { ChatProviderPicker } from "@/components/chat/ChatProviderPicker";
import { buildChatProviderOptions } from "@/lib/chat/providerOptions";

const options = buildChatProviderOptions({
  cli: { "claude-cli": true, "codex-cli": false, "gemini-cli": true },
  configured: { anthropic: true, openai: false, kimi: false, gemini: false },
});

function render(provider: string, modelName = "") {
  return renderToStaticMarkup(
    <ChatProviderPicker
      options={options}
      provider={provider}
      modelName={modelName}
      busy={false}
      onChange={() => {}}
    />,
  );
}

test("고른 CLI의 모델만 모델 드롭다운에 담는다", () => {
  const html = render("claude-cli");

  expect(html).toContain("sonnet");
  // 다른 제공자의 모델이 섞이면 저장에서 거절당하는 값을 고르게 된다.
  expect(html).not.toContain("gpt-5.5");
});

test("모델을 고르지 않은 상태는 기본 모델로 표시한다", () => {
  expect(render("codex-cli")).toContain("기본 모델");
});

test("설치되지 않은 CLI는 고를 수 없게 잠근다", () => {
  const html = render("claude-cli");

  expect(html).toContain('value="codex-cli" disabled=""');
});

test("API 제공자를 고르면 모델이 자막 분석과 공유된다고 알린다", () => {
  expect(render("anthropic")).toContain("자막 분석");
  expect(render("claude-cli")).not.toContain("자막 분석");
});
