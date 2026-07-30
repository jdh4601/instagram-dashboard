import { chmod, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { PROVIDER_IDS, PROVIDER_PRESETS, type ProviderId } from "@/lib/llm/providers";
import { maskApiKey } from "@/lib/settings/mask";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

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
  instagramTokenIssuedAt: z.string().optional(),
  instagramTokenExpiresAt: z.string().optional(),
});

// 정규화된 런타임 설정: 자막 분석과 생성에 사용할 텍스트 제공자.
interface Settings {
  textProvider: ProviderId;
  providers: z.infer<typeof ProvidersSchema>;
  instagram?: z.infer<typeof InstagramSchema>;
  /** Instagram 토큰이 새로 저장/변경된 시각(ISO). 장기 토큰은 60일에 만료된다. */
  instagramTokenIssuedAt?: string;
  /** OAuth token endpoint가 알려 준 실제 만료 시각. 수동 입력 토큰에는 없을 수 있다. */
  instagramTokenExpiresAt?: string;
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
type SettingsInput = z.infer<typeof SettingsInputSchema>;

interface MaskedProvider {
  configured: boolean;
  maskedKey: string | null;
  model: string;
}
interface MaskedSettings {
  textProvider: ProviderId;
  providers: Record<ProviderId, MaskedProvider>;
  instagram: {
    configured: boolean;
    maskedKey: string | null;
    managedByEnvironment: boolean;
  };
  instagramTokenIssuedAt: string | null;
  instagramTokenExpiresAt: string | null;
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
    instagramTokenIssuedAt: raw.instagramTokenIssuedAt,
    instagramTokenExpiresAt: raw.instagramTokenExpiresAt,
  };
}

export interface SettingsStore {
  get(): Promise<Settings>;
  save(incoming: SettingsInput): Promise<Settings>;
  saveInstagramCredential(credential: {
    accessToken: string;
    expiresAt?: string;
  }): Promise<Settings>;
  clearInstagramCredential(): Promise<Settings>;
  masked(): Promise<MaskedSettings>;
}

export function createSettingsStore(dataDir: string): SettingsStore {
  const file = join(dataDir, "settings.json");

  async function get(): Promise<Settings> {
    if (!existsSync(file)) return defaultSettings();
    // 업그레이드 전에 생성된 파일도 첫 접근부터 소유자 전용으로 교정한다.
    await chmod(file, 0o600);
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return defaultSettings();
    return normalize(StoredSettingsSchema.parse(JSON.parse(raw)));
  }

  async function write(settings: Settings): Promise<void> {
    // 새 임시 파일부터 0600으로 만든 뒤 원자적으로 교체해 키가 넓은 권한으로 노출되는 창을 막는다.
    await writeJsonAtomic(file, settings, { mode: 0o600 });
  }

  function save(incoming: SettingsInput): Promise<Settings> {
    return withFileLock(file, async () => {
      const cur = await get();
      const legacy = incoming.activeProvider;
      const next: Settings = {
        textProvider: incoming.textProvider ?? legacy ?? cur.textProvider,
        providers: { ...cur.providers },
        instagram: { ...cur.instagram },
        instagramTokenIssuedAt: cur.instagramTokenIssuedAt,
        instagramTokenExpiresAt: cur.instagramTokenExpiresAt,
      };
      if (incoming.instagram) {
        const incToken = incoming.instagram.accessToken?.trim();
        if (incToken && incToken !== cur.instagram?.accessToken) {
          // 토큰이 새로 저장/변경될 때만 발급일을 기록한다(빈 값·동일 값은 유지).
          next.instagram = { accessToken: incToken };
          next.instagramTokenIssuedAt = new Date().toISOString();
          next.instagramTokenExpiresAt = undefined;
        }
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
    });
  }

  function saveInstagramCredential(credential: {
    accessToken: string;
    expiresAt?: string;
  }): Promise<Settings> {
    return withFileLock(file, async () => {
      const current = await get();
      const accessToken = credential.accessToken.trim();
      if (!accessToken) throw new Error("Instagram access token must not be empty.");
      const next: Settings = {
        ...current,
        instagram: { accessToken },
        instagramTokenIssuedAt: new Date().toISOString(),
        instagramTokenExpiresAt: credential.expiresAt,
      };
      await write(next);
      return next;
    });
  }

  function clearInstagramCredential(): Promise<Settings> {
    return withFileLock(file, async () => {
      const current = await get();
      const next: Settings = {
        ...current,
        instagram: undefined,
        instagramTokenIssuedAt: undefined,
        instagramTokenExpiresAt: undefined,
      };
      await write(next);
      return next;
    });
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
        managedByEnvironment: false,
      },
      instagramTokenIssuedAt: s.instagramTokenIssuedAt ?? null,
      instagramTokenExpiresAt: s.instagramTokenExpiresAt ?? null,
    };
  }

  return { get, save, saveInstagramCredential, clearInstagramCredential, masked };
}
