import type { ProviderId } from "@/lib/llm/providers";

// 이 PC에 설치된 코딩 CLI를 챗봇 백엔드로 쓰기 위한 프리셋.
//
// 커맨드와 인자는 이 파일의 상수에서만 온다. 설정 파일이나 요청 본문에서 커맨드를
// 받으면 설정을 쓸 수 있는 사람이 곧 임의 코드를 실행할 수 있게 되므로, 사용자는
// "어느 프리셋을 쓸지"만 고를 수 있다. 모델 이름도 같은 이유로 models 목록에 있는
// 값만 인자로 나간다.
export type CliProviderId = "claude-cli" | "codex-cli" | "gemini-cli";

export const CLI_PROVIDER_IDS: CliProviderId[] = ["claude-cli", "codex-cli", "gemini-cli"];

/**
 * 진단 패널 드롭다운에 노출할 CLI.
 *
 * gemini-cli는 설정 화면에서는 계속 고를 수 있지만, 패널에서 즉석으로 바꾸는 용도로는
 * 쓰지 않기로 해서 목록을 좁혔다.
 */
export const CHAT_PANEL_CLI_IDS: CliProviderId[] = ["claude-cli", "codex-cli"];

export interface CliPreset {
  label: string;
  /** PATH에서 찾을 실행 파일 이름. 셸을 거치지 않으므로 공백·인자를 포함하면 안 된다. */
  command: string;
  /** 모델 인자 앞에 오는 고정 인자. 프롬프트는 argv가 아니라 stdin으로 전달한다. */
  args: string[];
  /** 모델 인자 뒤에 와야 하는 인자. 위치 인자는 플래그보다 뒤에 있어야 한다. */
  trailingArgs: string[];
  /** 모델을 지정하는 플래그. */
  modelFlag: string;
  /** 드롭다운에 노출할 모델. 비워 두면(선택 안 함) CLI 자신의 기본 모델이 쓰인다. */
  models: string[];
  /** 설정 화면에서 미설치일 때 보여줄 안내. */
  installHint: string;
}

export const CLI_PRESETS: Record<CliProviderId, CliPreset> = {
  "claude-cli": {
    label: "Claude Code CLI",
    command: "claude",
    args: ["-p", "--output-format", "text"],
    trailingArgs: [],
    modelFlag: "--model",
    // 별칭을 쓰면 모델이 세대교체돼도 최신 버전을 따라간다.
    models: ["fable", "opus", "sonnet", "haiku"],
    installHint: "npm i -g @anthropic-ai/claude-code",
  },
  "codex-cli": {
    label: "Codex CLI",
    command: "codex",
    args: ["exec", "--sandbox", "read-only"],
    // 마지막 "-"가 프롬프트를 stdin에서 읽으라는 뜻이다. 위치 인자라 항상 끝에 온다.
    trailingArgs: ["-"],
    modelFlag: "-m",
    models: ["gpt-5.6-sol", "gpt-5.5", "gpt-5.1-codex-max"],
    installHint: "npm i -g @openai/codex",
  },
  "gemini-cli": {
    label: "Gemini CLI",
    command: "gemini",
    args: [],
    // gemini는 -p에 값이 있어야 헤드리스로 돌고, stdin으로 들어온 입력 뒤에 이 문자열을
    // 붙여 최종 프롬프트를 만든다. 그래서 본문은 stdin에 두고 여기엔 마무리 지시만 둔다.
    trailingArgs: ["-p", "위 지침과 데이터에 근거해 마지막 질문에 답하세요."],
    modelFlag: "-m",
    models: ["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
    installHint: "npm i -g @google/gemini-cli (설치 후 `gemini` 실행해 로그인 필요)",
  },
};

/**
 * 프리셋 인자에 선택한 모델을 끼워 넣어 최종 argv를 만든다.
 *
 * 목록에 없는 이름은 조용히 버린다. 설정 파일이 손으로 편집되거나 예전에 저장한
 * 모델이 프리셋에서 빠졌을 때, 그 문자열이 CLI 플래그로 해석되면 안 되기 때문이다.
 */
export function buildCliArgs(id: CliProviderId, model?: string): string[] {
  const preset = CLI_PRESETS[id];
  const chosen = model?.trim() ?? "";
  const modelArgs = preset.models.includes(chosen) ? [preset.modelFlag, chosen] : [];
  return [...preset.args, ...modelArgs, ...preset.trailingArgs];
}

/** 챗봇이 쓸 수 있는 제공자. API 제공자와 로컬 CLI를 모두 포함한다. */
export type ChatProviderId = ProviderId | CliProviderId;

export function isCliProvider(id: string): id is CliProviderId {
  return (CLI_PROVIDER_IDS as string[]).includes(id);
}
