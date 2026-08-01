import { chmod, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { PROVIDER_IDS, PROVIDER_PRESETS, type ProviderId } from "@/lib/llm/providers";
import type { ChatProviderId } from "@/lib/llm/cliProviders";
import { maskApiKey } from "@/lib/settings/mask";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

const ProviderEnum = z.enum(["anthropic", "openai", "kimi", "gemini"]);

// 챗봇은 API 제공자 외에 이 PC의 CLI도 백엔드로 쓸 수 있다. 자막 분석·대본 생성은
// 구조화된 출력을 요구해서 CLI 경로를 쓰지 않으므로, textProvider와 분리해 둔다.
const ChatProviderEnum = z.enum([
  "anthropic",
  "openai",
  "kimi",
  "gemini",
  "claude-cli",
  "codex-cli",
  "gemini-cli",
]);

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

// 지원 신청을 받는 외부 폼(Walla). 클릭 다음 구간은 Graph가 주지 않아
// 이 폼의 응답 API를 끌어와야만 채워진다.
const WallaSchema = z.object({
  apiKey: z.string().optional(),
  formId: z.string().optional(),
});

// 디스크에 저장된 형태(관대): activeProvider는 구버전 단일 필드다.
const StoredSettingsSchema = z.object({
  activeProvider: ProviderEnum.optional(),
  textProvider: ProviderEnum.optional(),
  chatProvider: ChatProviderEnum.optional(),
  providers: ProvidersSchema,
  instagram: InstagramSchema.optional(),
  instagramTokenIssuedAt: z.string().optional(),
  instagramTokenExpiresAt: z.string().optional(),
  walla: WallaSchema.optional(),
});

// 정규화된 런타임 설정: 자막 분석과 생성에 사용할 텍스트 제공자.
interface Settings {
  textProvider: ProviderId;
  /** 진단 챗봇이 쓸 제공자. 사용자가 고른 적 없으면 textProvider를 따라간다. */
  chatProvider: ChatProviderId;
  /**
   * 사용자가 실제로 고른 값. 디스크에는 이 값만 기록해서 "고른 적 없음" 상태를
   * 보존한다. 해석된 chatProvider를 그대로 저장하면 textProvider를 바꿔도
   * 챗봇이 예전 값에 붙박이는 사고가 난다.
   */
  chatProviderExplicit?: ChatProviderId;
  providers: z.infer<typeof ProvidersSchema>;
  instagram?: z.infer<typeof InstagramSchema>;
  /** Instagram 토큰이 새로 저장/변경된 시각(ISO). 장기 토큰은 60일에 만료된다. */
  instagramTokenIssuedAt?: string;
  /** OAuth token endpoint가 알려 준 실제 만료 시각. 수동 입력 토큰에는 없을 수 있다. */
  instagramTokenExpiresAt?: string;
  /** 지원 신청 폼(Walla) 자격증명. 미설정이면 신청 동기화를 건너뛴다. */
  walla?: z.infer<typeof WallaSchema>;
}

// 클라이언트가 보내는 부분 업데이트 (apiKey 비우면 기존 유지)
export const SettingsInputSchema = z.object({
  activeProvider: ProviderEnum.optional(),
  textProvider: ProviderEnum.optional(),
  chatProvider: ChatProviderEnum.optional(),
  providers: z
    .object({
      anthropic: ProviderConfigSchema.optional(),
      openai: ProviderConfigSchema.optional(),
      kimi: ProviderConfigSchema.optional(),
      gemini: ProviderConfigSchema.optional(),
    })
    .optional(),
  instagram: InstagramSchema.optional(),
  walla: WallaSchema.optional(),
});
type SettingsInput = z.infer<typeof SettingsInputSchema>;

interface MaskedProvider {
  configured: boolean;
  maskedKey: string | null;
  model: string;
}
interface MaskedSettings {
  textProvider: ProviderId;
  chatProvider: ChatProviderId;
  providers: Record<ProviderId, MaskedProvider>;
  instagram: {
    configured: boolean;
    maskedKey: string | null;
    managedByEnvironment: boolean;
  };
  instagramTokenIssuedAt: string | null;
  instagramTokenExpiresAt: string | null;
  walla: {
    configured: boolean;
    maskedKey: string | null;
    /** 폼 ID는 비밀이 아니다. 어느 폼에 붙었는지 화면에서 확인할 수 있어야 한다. */
    formId: string | null;
  };
}

function defaultSettings(): Settings {
  return {
    textProvider: "anthropic",
    chatProvider: "anthropic",
    providers: { anthropic: {}, openai: {}, kimi: {}, gemini: {} },
  };
}

// 저장 형태 → 런타임 형태. 레거시 activeProvider를 textProvider 폴백으로 사용한다.
function normalize(raw: z.infer<typeof StoredSettingsSchema>): Settings {
  const fallback = raw.activeProvider ?? "anthropic";
  const textProvider = raw.textProvider ?? fallback;
  return {
    textProvider,
    // 이 기능 이전에 저장된 파일에는 chatProvider가 없다. 사용자가 이미 고른
    // 텍스트 제공자를 그대로 쓰는 것이 가장 덜 놀라운 기본값이다.
    chatProvider: raw.chatProvider ?? textProvider,
    chatProviderExplicit: raw.chatProvider,
    providers: raw.providers,
    instagram: raw.instagram,
    instagramTokenIssuedAt: raw.instagramTokenIssuedAt,
    instagramTokenExpiresAt: raw.instagramTokenExpiresAt,
    walla: raw.walla,
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
    // 해석된 런타임 값이 아니라 저장 형태로 되돌려 기록한다. chatProvider는 사용자가
    // 고른 적 있을 때만 남아야 하고, JSON.stringify가 undefined 필드를 빼 준다.
    const stored = {
      textProvider: settings.textProvider,
      chatProvider: settings.chatProviderExplicit,
      providers: settings.providers,
      instagram: settings.instagram,
      instagramTokenIssuedAt: settings.instagramTokenIssuedAt,
      instagramTokenExpiresAt: settings.instagramTokenExpiresAt,
      walla: settings.walla,
    };
    // 새 임시 파일부터 0600으로 만든 뒤 원자적으로 교체해 키가 넓은 권한으로 노출되는 창을 막는다.
    await writeJsonAtomic(file, stored, { mode: 0o600 });
  }

  function save(incoming: SettingsInput): Promise<Settings> {
    return withFileLock(file, async () => {
      const cur = await get();
      const legacy = incoming.activeProvider;
      const nextTextProvider = incoming.textProvider ?? legacy ?? cur.textProvider;
      const nextChatExplicit = incoming.chatProvider ?? cur.chatProviderExplicit;
      const next: Settings = {
        textProvider: nextTextProvider,
        chatProvider: nextChatExplicit ?? nextTextProvider,
        chatProviderExplicit: nextChatExplicit,
        providers: { ...cur.providers },
        instagram: { ...cur.instagram },
        instagramTokenIssuedAt: cur.instagramTokenIssuedAt,
        instagramTokenExpiresAt: cur.instagramTokenExpiresAt,
        walla: cur.walla,
      };
      if (incoming.walla) {
        const incKey = incoming.walla.apiKey?.trim();
        const incFormId = incoming.walla.formId?.trim();
        next.walla = {
          // 화면은 저장된 키를 마스킹해서 보여 준다. 빈 값이 실제 키를 덮어쓰면
          // 폼 ID만 고쳤을 뿐인데 연동이 조용히 끊긴다.
          apiKey: incKey ? incKey : cur.walla?.apiKey,
          formId: incFormId ? incFormId : cur.walla?.formId,
        };
      }
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
      chatProvider: s.chatProvider,
      providers,
      instagram: {
        configured: Boolean(igToken),
        maskedKey: igToken ? maskApiKey(igToken) : null,
        managedByEnvironment: false,
      },
      instagramTokenIssuedAt: s.instagramTokenIssuedAt ?? null,
      instagramTokenExpiresAt: s.instagramTokenExpiresAt ?? null,
      walla: {
        configured: Boolean(s.walla?.apiKey && s.walla?.formId),
        maskedKey: s.walla?.apiKey ? maskApiKey(s.walla.apiKey) : null,
        formId: s.walla?.formId ?? null,
      },
    };
  }

  return { get, save, saveInstagramCredential, clearInstagramCredential, masked };
}
