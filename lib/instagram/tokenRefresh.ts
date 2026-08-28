import { getSettingsStore } from "@/lib/settings";
import { refreshInstagramLongLivedToken } from "@/lib/instagram/oauth";

/** 남은 수명이 이 값 아래로 내려가면 갱신한다. 60일 토큰 기준으로 45일째부터다. */
const REFRESH_WHEN_REMAINING_MS = 15 * 24 * 60 * 60 * 1000;

/** Meta는 발급된 지 24시간이 지나지 않은 토큰의 갱신을 거부한다. */
const MIN_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

const RECONNECT_HINT =
  "Instagram 토큰이 이미 만료돼 갱신할 수 없습니다. /settings에서 다시 연결하세요.";

/**
 * 이 모듈이 설정 저장소에서 실제로 쓰는 부분만 추린 형태다. SettingsStore 전체가
 * 구조적으로 이 모양을 만족하므로, 테스트는 가벼운 대역을 넘길 수 있다.
 */
export interface TokenRefreshStore {
  get(): Promise<{
    instagram?: { accessToken?: string };
    instagramTokenIssuedAt?: string;
    instagramTokenExpiresAt?: string;
  }>;
  saveInstagramCredential(credential: {
    accessToken: string;
    expiresAt?: string;
  }): Promise<unknown>;
}

export type TokenRefreshOutcome =
  | { status: "skipped"; reason: "no-token" | "env-managed" | "not-due" | "too-fresh" }
  | { status: "refreshed"; expiresAt: string | null }
  | { status: "failed"; error: string };

export interface TokenRefreshOptions {
  store?: TokenRefreshStore;
  now?: Date;
  fetcher?: typeof fetch;
  env?: Readonly<Record<string, string | undefined>>;
}

function millisecondsUntil(timestamp: string | undefined, now: Date): number | null {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : parsed - now.getTime();
}

/**
 * 저장된 Instagram 장기 토큰이 만료에 가까워졌으면 미리 갱신한다.
 *
 * 갱신은 동기화의 곁다리 작업이라 절대 예외를 던지지 않는다. 실패는 사유를 담은
 * 결과로 돌려주고, 호출한 쪽이 리포트나 동기화를 그대로 이어 가게 둔다.
 */
export async function refreshInstagramTokenIfDue(
  options: TokenRefreshOptions = {},
): Promise<TokenRefreshOutcome> {
  const {
    store = getSettingsStore(),
    now = new Date(),
    fetcher = fetch,
    env = process.env,
  } = options;

  // 환경변수 토큰이 있으면 Graph 클라이언트가 그쪽을 먼저 쓴다. 저장된 토큰을
  // 갱신해 봐야 실제로 쓰이는 토큰은 그대로라, 손대지 않는 편이 정직하다.
  if (env.INSTAGRAM_ACCESS_TOKEN?.trim()) {
    return { status: "skipped", reason: "env-managed" };
  }

  const settings = await store.get();
  const accessToken = settings.instagram?.accessToken?.trim();
  if (!accessToken) return { status: "skipped", reason: "no-token" };

  const remainingMs = millisecondsUntil(settings.instagramTokenExpiresAt, now);
  if (remainingMs !== null) {
    if (remainingMs <= 0) return { status: "failed", error: RECONNECT_HINT };
    if (remainingMs > REFRESH_WHEN_REMAINING_MS) return { status: "skipped", reason: "not-due" };
  } else {
    // 설정 화면에 직접 붙여넣은 토큰에는 만료 시각이 없다. 한 번 갱신해 두면 그
    // 다음부터는 만료 시각을 알고 판단할 수 있으므로, 발급 24시간이 지났다면 시도한다.
    const ageMs = -(millisecondsUntil(settings.instagramTokenIssuedAt, now) ?? -Infinity);
    if (ageMs < MIN_TOKEN_AGE_MS) return { status: "skipped", reason: "too-fresh" };
  }

  try {
    const refreshed = await refreshInstagramLongLivedToken(accessToken, fetcher);
    const expiresAt =
      refreshed.expiresIn === null
        ? undefined
        : new Date(now.getTime() + refreshed.expiresIn * 1_000).toISOString();
    await store.saveInstagramCredential({ accessToken: refreshed.accessToken, expiresAt });
    return { status: "refreshed", expiresAt: expiresAt ?? null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "알 수 없는 오류";
    return { status: "failed", error: `Instagram 토큰 갱신에 실패했습니다: ${reason}` };
  }
}
