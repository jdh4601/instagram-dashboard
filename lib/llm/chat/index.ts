import { getSettingsStore } from "@/lib/settings";
import { PROVIDER_PRESETS, type ProviderId } from "@/lib/llm/providers";
import { CLI_PRESETS, isCliProvider, type ChatProviderId } from "@/lib/llm/cliProviders";
import { createAnthropicChatModel } from "@/lib/llm/chat/anthropic";
import { createOpenAICompatibleChatModel } from "@/lib/llm/chat/openaiCompatible";
import { createLocalCliChatModel } from "@/lib/llm/chat/localCli";
import type { ChatModel } from "@/lib/llm/types";

export interface ResolvedChatModel {
  provider: ChatProviderId;
  label: string;
  model: ChatModel;
}

/** 사람이 읽을 제공자 이름. 말풍선 배지와 오류 메시지에 함께 쓴다. */
export function chatProviderLabel(provider: ChatProviderId): string {
  return isCliProvider(provider)
    ? CLI_PRESETS[provider].label
    : PROVIDER_PRESETS[provider as ProviderId].label;
}

/**
 * 설정의 chatProvider로 채팅 모델을 만든다.
 *
 * CLI 제공자는 이 PC의 로그인 세션을 그대로 쓰므로 API 키를 요구하지 않는다.
 * API 제공자는 키가 없으면 어디서 설정하는지까지 알려 준다.
 */
export async function getChatModel(): Promise<ResolvedChatModel> {
  const settings = await getSettingsStore().get();
  const provider = settings.chatProvider;

  if (isCliProvider(provider)) {
    return {
      provider,
      label: CLI_PRESETS[provider].label,
      model: createLocalCliChatModel({ providerId: provider }),
    };
  }

  const apiProvider = provider as ProviderId;
  const preset = PROVIDER_PRESETS[apiProvider];
  const config = settings.providers[apiProvider];
  const model = config.model?.trim() ? config.model.trim() : preset.defaultModel;
  const apiKey =
    config.apiKey ?? (apiProvider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined);

  if (!apiKey) {
    throw new Error(
      `${preset.label} API 키가 설정되지 않았습니다. 설정(/settings)에서 키를 추가하거나 로컬 CLI를 선택하세요.`,
    );
  }

  return {
    provider,
    label: preset.label,
    model:
      apiProvider === "anthropic"
        ? createAnthropicChatModel({ apiKey, model })
        : createOpenAICompatibleChatModel({ apiKey, baseURL: preset.baseURL!, model }),
  };
}
