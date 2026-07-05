import { getSettingsStore } from "@/lib/settings";
import { PROVIDER_PRESETS, type ProviderId, type ProviderPreset } from "@/lib/llm/providers";
import { createAnthropicTextModel } from "@/lib/llm/anthropic";
import { createOpenAICompatibleTextModel } from "@/lib/llm/openaiCompatible";
import type { TextModel } from "@/lib/llm/types";

interface ResolvedProvider {
  active: ProviderId;
  apiKey: string;
  model: string;
  preset: ProviderPreset;
}

// 활성 제공자 + 키 + 모델을 설정에서 해석. 키 없으면 env 폴백(Anthropic만).
async function resolveActiveProvider(): Promise<ResolvedProvider> {
  const settings = await getSettingsStore().get();
  const active = settings.textProvider;
  const cfg = settings.providers[active];
  const preset = PROVIDER_PRESETS[active];
  const model = cfg.model && cfg.model.trim() ? cfg.model.trim() : preset.defaultModel;
  const apiKey =
    cfg.apiKey ?? (active === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined);
  if (!apiKey) {
    throw new Error(
      `${preset.label} API 키가 설정되지 않았습니다. 대시보드 설정(/settings)에서 키를 추가하세요.`,
    );
  }
  return { active, apiKey, model, preset };
}

// 자막 분석·맞춤 대본 생성용 텍스트 모델 (textProvider 사용)
export async function getTextModel(): Promise<TextModel> {
  const { active, apiKey, model, preset } = await resolveActiveProvider();
  if (active === "anthropic") return createAnthropicTextModel({ apiKey, model });
  return createOpenAICompatibleTextModel({ apiKey, baseURL: preset.baseURL!, model });
}
