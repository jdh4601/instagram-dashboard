import { z } from "zod";

const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_LONG_LIVED_TOKEN_URL = "https://graph.instagram.com/access_token";
export const INSTAGRAM_OAUTH_STATE_COOKIE = "instagram_oauth_state";

const INSTAGRAM_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
] as const;

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export interface InstagramOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export interface InstagramOAuthStatus {
  configured: boolean;
  redirectUri: string | null;
  configurationError: boolean;
}

function validateRedirectUri(value: string): string {
  const uri = new URL(value);
  const localHttp =
    uri.protocol === "http:" && (uri.hostname === "localhost" || uri.hostname === "127.0.0.1");
  if (uri.protocol !== "https:" && !localHttp) {
    throw new Error("INSTAGRAM_OAUTH_REDIRECT_URI must use HTTPS (HTTP is allowed on localhost).");
  }
  if (uri.username || uri.password || uri.hash) {
    throw new Error("INSTAGRAM_OAUTH_REDIRECT_URI must not contain credentials or a fragment.");
  }
  return uri.toString();
}

export function resolveInstagramOAuthConfig(
  env: RuntimeEnvironment = process.env,
): InstagramOAuthConfig | null {
  const appId = env.INSTAGRAM_APP_ID?.trim();
  const appSecret = env.INSTAGRAM_APP_SECRET?.trim();
  const rawRedirectUri = env.INSTAGRAM_OAUTH_REDIRECT_URI?.trim();
  const configuredCount = [appId, appSecret, rawRedirectUri].filter(Boolean).length;
  if (configuredCount === 0) return null;
  if (configuredCount !== 3) {
    throw new Error(
      "Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and INSTAGRAM_OAUTH_REDIRECT_URI together.",
    );
  }
  return {
    appId: appId!,
    appSecret: appSecret!,
    redirectUri: validateRedirectUri(rawRedirectUri!),
  };
}

export function getInstagramOAuthStatus(
  env: RuntimeEnvironment = process.env,
): InstagramOAuthStatus {
  try {
    const config = resolveInstagramOAuthConfig(env);
    return {
      configured: Boolean(config),
      redirectUri: config?.redirectUri ?? null,
      configurationError: false,
    };
  } catch {
    return { configured: false, redirectUri: null, configurationError: true };
  }
}

export function buildInstagramAuthorizationUrl(
  config: InstagramOAuthConfig,
  state: string,
): URL {
  const url = new URL(INSTAGRAM_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_OAUTH_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url;
}

const ShortLivedTokenSchema = z.object({
  access_token: z.string().min(1),
});
const LongLivedTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive().optional(),
});

async function readProviderJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`Instagram token endpoint returned an invalid response (${response.status}).`);
  }
}

export async function exchangeInstagramAuthorizationCode(
  code: string,
  config: InstagramOAuthConfig,
  fetcher: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresIn: number | null }> {
  const form = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code,
  });
  const shortResponse = await fetcher(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    cache: "no-store",
  });
  const shortBody = await readProviderJson(shortResponse);
  if (!shortResponse.ok) {
    throw new Error(`Instagram code exchange failed (${shortResponse.status}).`);
  }
  const shortToken = ShortLivedTokenSchema.parse(shortBody).access_token;

  const longUrl = new URL(INSTAGRAM_LONG_LIVED_TOKEN_URL);
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", config.appSecret);
  longUrl.searchParams.set("access_token", shortToken);
  const longResponse = await fetcher(longUrl, { cache: "no-store" });
  const longBody = await readProviderJson(longResponse);
  if (!longResponse.ok) {
    throw new Error(`Instagram long-lived token exchange failed (${longResponse.status}).`);
  }
  const parsed = LongLivedTokenSchema.parse(longBody);
  return { accessToken: parsed.access_token, expiresIn: parsed.expires_in ?? null };
}
