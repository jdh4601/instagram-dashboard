import { buildChatProviderOptions } from "@/lib/chat/providerOptions";

const allDetected = { "claude-cli": true, "codex-cli": true, "gemini-cli": true };
const noKeys = { anthropic: false, openai: false, kimi: false, gemini: false };

test("패널 선택지는 CLI 두 개를 먼저 놓고 API 제공자를 뒤에 붙인다", () => {
  const options = buildChatProviderOptions({ cli: allDetected, configured: noKeys });

  expect(options.map((o) => o.id)).toEqual([
    "claude-cli",
    "codex-cli",
    "anthropic",
    "openai",
    "kimi",
    "gemini",
  ]);
});

test("감지되지 않은 CLI는 고를 수 없고 설치 안내를 단다", () => {
  const options = buildChatProviderOptions({
    cli: { ...allDetected, "codex-cli": false },
    configured: noKeys,
  });
  const codex = options.find((o) => o.id === "codex-cli")!;

  expect(codex.ready).toBe(false);
  expect(codex.hint).toContain("codex");
});

test("키가 없는 API 제공자는 고를 수 없다", () => {
  const options = buildChatProviderOptions({
    cli: allDetected,
    configured: { ...noKeys, anthropic: true },
  });

  expect(options.find((o) => o.id === "anthropic")!.ready).toBe(true);
  expect(options.find((o) => o.id === "openai")!.ready).toBe(false);
});

test("CLI 모델은 이 챗봇 전용이고 API 제공자 모델은 자막 분석과 공유된다", () => {
  const options = buildChatProviderOptions({ cli: allDetected, configured: noKeys });

  expect(options.find((o) => o.id === "claude-cli")!.sharedModel).toBe(false);
  expect(options.find((o) => o.id === "anthropic")!.sharedModel).toBe(true);
});

test("모든 선택지는 드롭다운에 채울 모델 목록을 가진다", () => {
  for (const option of buildChatProviderOptions({ cli: allDetected, configured: noKeys })) {
    expect(option.models.length).toBeGreaterThan(0);
  }
});
