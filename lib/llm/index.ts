import { getSettingsStore } from "@/lib/settings";
import { PROVIDER_PRESETS, type ProviderId, type ProviderPreset } from "@/lib/llm/providers";
import { createAnthropicVisionModel, createAnthropicTextModel } from "@/lib/llm/anthropic";
import {
  createOpenAICompatibleVisionModel,
  createOpenAICompatibleTextModel,
} from "@/lib/llm/openaiCompatible";
import type { VisionModel, TextModel } from "@/lib/llm/types";

interface ResolvedProvider {
  active: ProviderId;
  apiKey: string;
  model: string;
  preset: ProviderPreset;
}

// 활성 제공자 + 키 + 모델을 설정에서 해석. 키 없으면 env 폴백(Anthropic만).
async function resolveActiveProvider(kind: "text" | "vision"): Promise<ResolvedProvider> {
  const settings = await getSettingsStore().get();
  const active = kind === "vision" ? settings.visionProvider : settings.textProvider;
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

// 스크린샷 파싱용 비전 모델 (visionProvider 사용)
export async function getVisionModel(): Promise<VisionModel> {
  const { active, apiKey, model, preset } = await resolveActiveProvider("vision");
  if (active === "anthropic") return createAnthropicVisionModel({ apiKey, model });
  return createOpenAICompatibleVisionModel({ apiKey, baseURL: preset.baseURL!, model });
}

// 자막 분석·맞춤 대본 생성용 텍스트 모델 (textProvider 사용)
export async function getTextModel(): Promise<TextModel> {
  const { active, apiKey, model, preset } = await resolveActiveProvider("text");
  if (active === "anthropic") return createAnthropicTextModel({ apiKey, model });
  return createOpenAICompatibleTextModel({ apiKey, baseURL: preset.baseURL!, model });
}
