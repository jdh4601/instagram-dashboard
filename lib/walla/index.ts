import { getSettingsStore } from "@/lib/settings";
import { createWallaClient, type WallaClient } from "@/lib/walla/client";

export interface WallaConnection {
  client: WallaClient;
  formId: string;
}

/** 저장 전에 시험해 볼 값. 빈 값은 없는 것으로 보고 저장된 자격증명으로 넘어간다. */
export interface WallaCredentialOverride {
  apiKey?: string;
  formId?: string;
}

/**
 * 설정에 저장된 자격증명으로 Walla 클라이언트를 만든다.
 *
 * 미설정이면 던지지 않고 null을 준다. Instagram 토큰과 달리 신청 폼 연동은 선택
 * 기능이라, 붙이지 않은 사용자의 동기화를 실패시키면 안 된다.
 *
 * override는 연결 테스트가 쓴다. 아직 저장하지 않은 입력값을 시험해야 하는데,
 * 해석 순서를 그쪽에 따로 두면 "테스트는 통과하는데 동기화는 실패한다"가 생긴다.
 */
export async function getWallaConnection(
  override?: WallaCredentialOverride,
): Promise<WallaConnection | null> {
  const settings = await getSettingsStore().get();
  const apiKey =
    override?.apiKey?.trim() || process.env.WALLA_API_KEY?.trim() || settings.walla?.apiKey;
  const formId =
    override?.formId?.trim() || process.env.WALLA_FORM_ID?.trim() || settings.walla?.formId;
  if (!apiKey || !formId) return null;
  return { client: createWallaClient({ apiKey }), formId };
}
