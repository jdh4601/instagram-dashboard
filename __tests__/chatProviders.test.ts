import { CLI_PRESETS, CLI_PROVIDER_IDS, isCliProvider } from "@/lib/llm/cliProviders";
import { resolveRuntimeConfig } from "@/lib/runtime/config";

test("CLI 프리셋은 세 종류를 셸 없이 실행할 수 있는 형태로 정의한다", () => {
  expect(CLI_PROVIDER_IDS).toEqual(["claude-cli", "codex-cli", "gemini-cli"]);

  for (const id of CLI_PROVIDER_IDS) {
    const preset = CLI_PRESETS[id];
    expect(preset.label.length).toBeGreaterThan(0);
    // 커맨드는 인자 없는 실행 파일 이름이어야 한다. 공백이 있으면 셸 해석에 기대는 것이다.
    expect(preset.command).not.toContain(" ");
    expect(Array.isArray(preset.args)).toBe(true);
  }
});

test("isCliProvider는 CLI 제공자만 참으로 판별한다", () => {
  expect(isCliProvider("claude-cli")).toBe(true);
  expect(isCliProvider("codex-cli")).toBe(true);
  expect(isCliProvider("gemini-cli")).toBe(true);
  expect(isCliProvider("anthropic")).toBe(false);
  expect(isCliProvider("openai")).toBe(false);
});

test("VERCEL 환경변수가 있으면 로컬 런타임이 아니다", () => {
  expect(resolveRuntimeConfig({ VERCEL: "1" }, "/tmp").isLocalRuntime).toBe(false);
  expect(resolveRuntimeConfig({}, "/tmp").isLocalRuntime).toBe(true);
});
