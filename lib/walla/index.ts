import { getSettingsStore } from "@/lib/settings";
import { createWallaClient, type WallaClient } from "@/lib/walla/client";

export interface WallaConnection {
  client: WallaClient;
  formId: string;
}

/**
 * 설정에 저장된 자격증명으로 Walla 클라이언트를 만든다.
 *
 * 미설정이면 던지지 않고 null을 준다. Instagram 토큰과 달리 신청 폼 연동은 선택
 * 기능이라, 붙이지 않은 사용자의 동기화를 실패시키면 안 된다.
 */
export async function getWallaConnection(): Promise<WallaConnection | null> {
  const settings = await getSettingsStore().get();
  const apiKey = process.env.WALLA_API_KEY?.trim() || settings.walla?.apiKey;
  const formId = process.env.WALLA_FORM_ID?.trim() || settings.walla?.formId;
  if (!apiKey || !formId) return null;
  return { client: createWallaClient({ apiKey }), formId };
}
