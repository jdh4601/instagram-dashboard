export type ProviderId = "anthropic" | "openai" | "kimi" | "gemini";

export const PROVIDER_IDS: ProviderId[] = ["anthropic", "openai", "kimi", "gemini"];

export interface ProviderPreset {
  label: string;
  defaultModel: string;
  models: string[]; // UI 드롭다운용 선택 가능 모델 목록(defaultModel 포함). 튜닝은 이 파일에서.
  baseURL: string | null; // null = 네이티브 SDK(Anthropic), 그 외 = OpenAI 호환 baseURL
  vision: boolean;
}

// 제공자별 기본값. 모델 목록은 UI 드롭다운에 노출(필요 시 여기서 추가).
export const PROVIDER_PRESETS: Record<ProviderId, ProviderPreset> = {
  anthropic: {
    label: "Anthropic (Claude)",
    defaultModel: "claude-opus-4-8",
    models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    baseURL: null,
    vision: true,
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
    baseURL: "https://api.openai.com/v1",
    vision: true,
  },
  kimi: {
    label: "Kimi (Moonshot)",
    defaultModel: "moonshot-v1-8k-vision-preview",
    models: [
      "moonshot-v1-8k-vision-preview",
      "moonshot-v1-32k-vision-preview",
      "moonshot-v1-128k-vision-preview",
    ],
    baseURL: "https://api.moonshot.ai/v1",
    vision: true,
  },
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-lite"],
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    vision: true,
  },
};
