import {
  CHAT_PANEL_CLI_IDS,
  CLI_PRESETS,
  type ChatProviderId,
  type CliProviderId,
} from "@/lib/llm/cliProviders";
import { PROVIDER_IDS, PROVIDER_PRESETS, type ProviderId } from "@/lib/llm/providers";

/** 진단 패널 드롭다운 한 줄. 서버만 아는 사실(감지·키 등록)을 화면에 실어 보낸다. */
export interface ChatProviderOption {
  id: ChatProviderId;
  label: string;
  kind: "api" | "cli";
  /** 지금 고를 수 있는지. CLI는 설치 감지 여부, API는 키 등록 여부다. */
  ready: boolean;
  /** 고를 수 없을 때 무엇을 하면 되는지. */
  hint: string | null;
  models: string[];
  /**
   * 이 제공자의 모델이 자막 분석과 같은 값을 쓰는지.
   *
   * API 제공자는 설정에 모델 칸이 하나뿐이라 패널에서 바꾸면 자막 분석도 따라 바뀐다.
   * 화면에서 그 사실을 숨기면 사용자가 모르는 사이에 분석 모델이 바뀐다.
   */
  sharedModel: boolean;
}

interface Input {
  cli: Record<CliProviderId, boolean>;
  configured: Record<ProviderId, boolean>;
}

/** CLI를 먼저 놓는다. 이 패널을 로컬 CLI로 돌리는 것이 기본 사용법이다. */
export function buildChatProviderOptions({ cli, configured }: Input): ChatProviderOption[] {
  const cliOptions = CHAT_PANEL_CLI_IDS.map((id) => {
    const preset = CLI_PRESETS[id];
    const detected = cli[id];
    return {
      id,
      label: preset.label,
      kind: "cli" as const,
      ready: detected,
      hint: detected ? null : `'${preset.command}' 미설치 — ${preset.installHint}`,
      models: preset.models,
      sharedModel: false,
    };
  });

  const apiOptions = PROVIDER_IDS.map((id) => ({
    id,
    label: PROVIDER_PRESETS[id].label,
    kind: "api" as const,
    ready: configured[id],
    hint: configured[id] ? null : "API 키가 없습니다 — 설정에서 등록하세요",
    models: PROVIDER_PRESETS[id].models,
    sharedModel: true,
  }));

  return [...cliOptions, ...apiOptions];
}
