import { getSettingsStore } from "@/lib/settings";
import { createAdsClient, type AdsClient } from "@/lib/ads/client";

export interface AdsConnection {
  client: AdsClient;
  adAccountId: string;
}

/** 저장 전에 시험해 볼 값. 빈 값은 없는 것으로 보고 저장된 자격증명으로 넘어간다. */
export interface AdsCredentialOverride {
  accessToken?: string;
  adAccountId?: string;
}

/** act_ 접두어를 붙여 준다 — 사용자가 숫자만 붙여넣는 실수가 잦다. */
export function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

/**
 * 설정에 저장된 자격증명으로 Marketing API 클라이언트를 만든다.
 *
 * 미설정이면 던지지 않고 null을 준다. Instagram 토큰과 달리 광고 연동은 선택
 * 기능이라, 붙이지 않은 사용자의 동기화를 실패시키면 안 된다.
 */
export async function getAdsConnection(
  override?: AdsCredentialOverride,
): Promise<AdsConnection | null> {
  const settings = await getSettingsStore().get();
  const accessToken =
    override?.accessToken?.trim() ||
    process.env.META_ADS_TOKEN?.trim() ||
    settings.metaAds?.accessToken;
  const rawAccount =
    override?.adAccountId?.trim() ||
    process.env.META_AD_ACCOUNT_ID?.trim() ||
    settings.metaAds?.adAccountId;
  if (!accessToken || !rawAccount) return null;
  return {
    client: createAdsClient({ accessToken }),
    adAccountId: normalizeAdAccountId(rawAccount),
  };
}
