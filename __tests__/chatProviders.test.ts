import {
  buildCliArgs,
  CHAT_PANEL_CLI_IDS,
  CLI_PRESETS,
  CLI_PROVIDER_IDS,
  isCliProvider,
} from "@/lib/llm/cliProviders";
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

test("buildCliArgs는 프리셋 인자 사이에 모델 플래그를 끼워 넣는다", () => {
  expect(buildCliArgs("claude-cli", "sonnet")).toEqual([
    "-p",
    "--output-format",
    "text",
    "--model",
    "sonnet",
  ]);
  // codex는 stdin 표식 "-"가 마지막 위치 인자여야 하므로 모델은 그 앞에 온다.
  expect(buildCliArgs("codex-cli", "gpt-5.5")).toEqual([
    "exec",
    "--sandbox",
    "read-only",
    "-m",
    "gpt-5.5",
    "-",
  ]);
});

test("buildCliArgs는 모델을 고르지 않으면 플래그를 붙이지 않는다", () => {
  expect(buildCliArgs("claude-cli")).toEqual(["-p", "--output-format", "text"]);
  expect(buildCliArgs("codex-cli", "")).toEqual(["exec", "--sandbox", "read-only", "-"]);
});

test("buildCliArgs는 프리셋 목록에 없는 모델 이름을 버린다", () => {
  // 설정 파일에 임의 문자열이 들어와도 그것이 CLI 인자로 흘러가면 안 된다.
  expect(buildCliArgs("claude-cli", "--dangerously-skip-permissions")).toEqual([
    "-p",
    "--output-format",
    "text",
  ]);
});

test("모든 프리셋은 드롭다운에 쓸 모델 목록과 플래그를 가진다", () => {
  for (const id of CLI_PROVIDER_IDS) {
    const preset = CLI_PRESETS[id];
    expect(preset.modelFlag.startsWith("-")).toBe(true);
    expect(preset.models.length).toBeGreaterThan(0);
    // 빈 문자열은 "CLI 기본값"을 뜻하는 UI 전용 값이라 목록에 있으면 안 된다.
    expect(preset.models).not.toContain("");
  }
});

test("패널 드롭다운은 claude·codex CLI만 노출한다", () => {
  expect(CHAT_PANEL_CLI_IDS).toEqual(["claude-cli", "codex-cli"]);
});
