import type { ProviderId } from "@/lib/llm/providers";

// 이 PC에 설치된 코딩 CLI를 챗봇 백엔드로 쓰기 위한 프리셋.
//
// 커맨드와 인자는 이 파일의 상수에서만 온다. 설정 파일이나 요청 본문에서 커맨드를
// 받으면 설정을 쓸 수 있는 사람이 곧 임의 코드를 실행할 수 있게 되므로, 사용자는
// "어느 프리셋을 쓸지"만 고를 수 있다.
export type CliProviderId = "claude-cli" | "codex-cli" | "gemini-cli";

export const CLI_PROVIDER_IDS: CliProviderId[] = ["claude-cli", "codex-cli", "gemini-cli"];

export interface CliPreset {
  label: string;
  /** PATH에서 찾을 실행 파일 이름. 셸을 거치지 않으므로 공백·인자를 포함하면 안 된다. */
  command: string;
  /** 고정 인자. 프롬프트는 argv가 아니라 stdin으로 전달한다. */
  args: string[];
  /** 설정 화면에서 미설치일 때 보여줄 안내. */
  installHint: string;
}

export const CLI_PRESETS: Record<CliProviderId, CliPreset> = {
  "claude-cli": {
    label: "Claude Code CLI",
    command: "claude",
    args: ["-p", "--output-format", "text"],
    installHint: "npm i -g @anthropic-ai/claude-code",
  },
  "codex-cli": {
    label: "Codex CLI",
    command: "codex",
    // 마지막 "-"가 프롬프트를 stdin에서 읽으라는 뜻이다.
    args: ["exec", "--sandbox", "read-only", "-"],
    installHint: "npm i -g @openai/codex",
  },
  "gemini-cli": {
    label: "Gemini CLI",
    command: "gemini",
    // gemini는 -p에 값이 있어야 헤드리스로 돌고, stdin으로 들어온 입력 뒤에 이 문자열을
    // 붙여 최종 프롬프트를 만든다. 그래서 본문은 stdin에 두고 여기엔 마무리 지시만 둔다.
    args: ["-p", "위 지침과 데이터에 근거해 마지막 질문에 답하세요."],
    installHint: "npm i -g @google/gemini-cli (설치 후 `gemini` 실행해 로그인 필요)",
  },
};

/** 챗봇이 쓸 수 있는 제공자. API 제공자와 로컬 CLI를 모두 포함한다. */
export type ChatProviderId = ProviderId | CliProviderId;

export function isCliProvider(id: string): id is CliProviderId {
  return (CLI_PROVIDER_IDS as string[]).includes(id);
}
