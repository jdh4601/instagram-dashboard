import type { ChatProviderId } from "@/lib/llm/cliProviders";

let stored: {
  chatProvider: ChatProviderId;
  cliProviders: Record<string, { model?: string }>;
  providers: Record<string, { apiKey?: string; model?: string }>;
};

vi.mock("@/lib/settings", () => ({
  getSettingsStore: () => ({ get: async () => stored }),
}));

let spawned: { command: string; args: string[] } | null = null;
vi.mock("node:child_process", () => ({
  spawn: (command: string, args: string[]) => {
    spawned = { command, args };
    throw new Error("테스트는 실제로 CLI를 띄우지 않는다");
  },
}));

const { getChatModel } = await import("@/lib/llm/chat");

beforeEach(() => {
  spawned = null;
  stored = {
    chatProvider: "codex-cli",
    cliProviders: { "claude-cli": {}, "codex-cli": {}, "gemini-cli": {} },
    providers: { anthropic: {}, openai: {}, kimi: {}, gemini: {} },
  };
});

test("CLI 제공자는 설정에 저장된 모델을 그대로 알려 준다", async () => {
  stored.cliProviders["codex-cli"] = { model: "gpt-5.5" };

  const resolved = await getChatModel();

  expect(resolved.provider).toBe("codex-cli");
  expect(resolved.modelName).toBe("gpt-5.5");
});

test("CLI 모델을 고르지 않았으면 빈 값으로 알려 준다", async () => {
  stored.chatProvider = "claude-cli";

  expect((await getChatModel()).modelName).toBe("");
});

test("API 제공자는 프리셋 기본 모델로 채워진다", async () => {
  stored.chatProvider = "anthropic";
  stored.providers.anthropic = { apiKey: "sk-test" };

  expect((await getChatModel()).modelName).toBe("claude-opus-4-8");
});
