import { getSettingsStore } from "@/lib/settings";
import { PROVIDER_PRESETS, type ProviderId, type ProviderPreset } from "@/lib/llm/providers";
import { createAnthropicTextModel, createAnthropicVisionModel } from "@/lib/llm/anthropic";
import {
  createOpenAICompatibleTextModel,
  createOpenAICompatibleVisionModel,
} from "@/lib/llm/openaiCompatible";
import type { TextModel, VisionModel } from "@/lib/llm/types";

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

/** 릴스 프레임을 읽는 해체 기능용. 활성 텍스트 제공자의 같은 모델·키를 재사용한다. */
export async function getVisionModel(): Promise<VisionModel> {
  const { active, apiKey, model, preset } = await resolveActiveProvider();
  if (!preset.vision) throw new Error(`${preset.label}의 현재 모델은 이미지를 읽을 수 없습니다.`);
  if (active === "anthropic") return createAnthropicVisionModel({ apiKey, model });
  return createOpenAICompatibleVisionModel({ apiKey, baseURL: preset.baseURL!, model });
}
