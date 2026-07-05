import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { PROVIDER_IDS, PROVIDER_PRESETS, type ProviderId } from "@/lib/llm/providers";
import { maskApiKey } from "@/lib/settings/mask";

const ProviderEnum = z.enum(["anthropic", "openai", "kimi", "gemini"]);

const ProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

const ProvidersSchema = z.object({
  anthropic: ProviderConfigSchema,
  openai: ProviderConfigSchema,
  kimi: ProviderConfigSchema,
  gemini: ProviderConfigSchema,
});

const InstagramSchema = z.object({ accessToken: z.string().optional() });

// 디스크에 저장된 형태(관대): activeProvider는 구버전 단일 필드다.
const StoredSettingsSchema = z.object({
  activeProvider: ProviderEnum.optional(),
  textProvider: ProviderEnum.optional(),
  providers: ProvidersSchema,
  instagram: InstagramSchema.optional(),
});

// 정규화된 런타임 설정: 자막 분석과 생성에 사용할 텍스트 제공자.
export interface Settings {
  textProvider: ProviderId;
  providers: z.infer<typeof ProvidersSchema>;
  instagram?: z.infer<typeof InstagramSchema>;
}

// 클라이언트가 보내는 부분 업데이트 (apiKey 비우면 기존 유지)
export const SettingsInputSchema = z.object({
  activeProvider: ProviderEnum.optional(),
  textProvider: ProviderEnum.optional(),
  providers: z
    .object({
      anthropic: ProviderConfigSchema.optional(),
      openai: ProviderConfigSchema.optional(),
      kimi: ProviderConfigSchema.optional(),
      gemini: ProviderConfigSchema.optional(),
    })
    .optional(),
  instagram: InstagramSchema.optional(),
});
export type SettingsInput = z.infer<typeof SettingsInputSchema>;

export interface MaskedProvider {
  configured: boolean;
  maskedKey: string | null;
  model: string;
}
export interface MaskedSettings {
  textProvider: ProviderId;
  providers: Record<ProviderId, MaskedProvider>;
  instagram: { configured: boolean; maskedKey: string | null };
}

function defaultSettings(): Settings {
  return {
    textProvider: "anthropic",
    providers: { anthropic: {}, openai: {}, kimi: {}, gemini: {} },
  };
}

// 저장 형태 → 런타임 형태. 레거시 activeProvider를 textProvider 폴백으로 사용한다.
function normalize(raw: z.infer<typeof StoredSettingsSchema>): Settings {
  const fallback = raw.activeProvider ?? "anthropic";
  return {
    textProvider: raw.textProvider ?? fallback,
    providers: raw.providers,
    instagram: raw.instagram,
  };
}

export interface SettingsStore {
  get(): Promise<Settings>;
  save(incoming: SettingsInput): Promise<Settings>;
  masked(): Promise<MaskedSettings>;
}

export function createSettingsStore(dataDir: string): SettingsStore {
  const file = join(dataDir, "settings.json");

  async function get(): Promise<Settings> {
    if (!existsSync(file)) return defaultSettings();
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return defaultSettings();
    return normalize(StoredSettingsSchema.parse(JSON.parse(raw)));
  }

  async function write(settings: Settings): Promise<void> {
    if (!existsSync(dataDir)) await mkdir(dataDir, { recursive: true });
    await writeFile(file, JSON.stringify(settings, null, 2), "utf8");
  }

  async function save(incoming: SettingsInput): Promise<Settings> {
    const cur = await get();
    const legacy = incoming.activeProvider;
    const next: Settings = {
      textProvider: incoming.textProvider ?? legacy ?? cur.textProvider,
      providers: { ...cur.providers },
      instagram: { ...cur.instagram },
    };
    if (incoming.instagram) {
      const incToken = incoming.instagram.accessToken?.trim();
      next.instagram = { accessToken: incToken ? incToken : cur.instagram?.accessToken };
    }
    for (const id of PROVIDER_IDS) {
      const inc = incoming.providers?.[id];
      if (!inc) continue;
      const existing = cur.providers[id];
      const trimmedKey = inc.apiKey?.trim();
      next.providers[id] = {
        apiKey: trimmedKey ? trimmedKey : existing.apiKey, // 빈 값이면 기존 유지
        model: inc.model !== undefined ? inc.model : existing.model,
      };
    }
    await write(next);
    return next;
  }

  async function masked(): Promise<MaskedSettings> {
    const s = await get();
    const providers = {} as Record<ProviderId, MaskedProvider>;
    for (const id of PROVIDER_IDS) {
      const c = s.providers[id];
      providers[id] = {
        configured: Boolean(c.apiKey),
        maskedKey: c.apiKey ? maskApiKey(c.apiKey) : null,
        model: c.model ?? PROVIDER_PRESETS[id].defaultModel,
      };
    }
    const igToken = s.instagram?.accessToken;
    return {
      textProvider: s.textProvider,
      providers,
      instagram: {
        configured: Boolean(igToken),
        maskedKey: igToken ? maskApiKey(igToken) : null,
      },
    };
  }

  return { get, save, masked };
}
