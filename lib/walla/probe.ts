import { WallaRequestError, type WallaClient } from "@/lib/walla/client";
import { UTM_KEYS, buildHiddenFieldMap, type UtmKey } from "@/lib/walla/map";

export interface WallaProbeOk {
  ok: true;
  /** 폼에 정의된 필드 수. */
  fieldCount: number;
  /** UTM으로 인식된 축. */
  utmKeys: UtmKey[];
  /**
   * 인식되지 않은 축. 비어 있지 않으면 그 축의 집계는 채워지지 않는다.
   * 특히 medium이 없으면 바이오 유입을 가려낼 수 없어 신청 전환율이 영영 0%다.
   */
  missingUtmKeys: UtmKey[];
}

export type WallaProbeFailReason =
  /** 키가 거부됨 — 사용자가 고칠 곳은 API 키다. */
  | "unauthorized"
  /** 키는 통과했는데 폼이 없음 — 고칠 곳은 폼 ID다. */
  | "formNotFound"
  /** Walla가 오류 상태로 답함. 우리 쪽에서 할 일이 없다. */
  | "requestFailed"
  /** 요청 자체가 나가지 못함(네트워크·DNS). */
  | "unreachable";

export interface WallaProbeFail {
  ok: false;
  reason: WallaProbeFailReason;
  /** 화면에 그대로 띄우는 문구. 자격증명을 담지 않는다. */
  message: string;
}

export type WallaProbeResult = WallaProbeOk | WallaProbeFail;

function fail(reason: WallaProbeFailReason, message: string): WallaProbeFail {
  return { ok: false, reason, message };
}

/**
 * 저장하기 전에 자격증명이 실제로 통하는지 확인한다.
 *
 * 필드 목록을 고른 이유: 응답 목록과 같은 인증을 쓰면서 신청자 개인정보를 한 건도
 * 끌어오지 않고, 동시에 UTM 숨김 필드가 붙어 있는지까지 한 번에 확인된다.
 *
 * 인증만 보고 끝내지 않는 이유: 키가 살아 있어도 숨김 필드 라벨이 매핑에 걸리지
 * 않으면 신청 수만 쌓이고 전환율은 계속 0%로 남는다. 그 상태를 동기화를 여러 번
 * 돌린 뒤에 발견하면 원인을 되짚기 어렵다.
 */
export async function probeWallaConnection(
  client: WallaClient,
  formId: string,
): Promise<WallaProbeResult> {
  let fields;
  try {
    fields = await client.listFields(formId);
  } catch (err) {
    if (err instanceof WallaRequestError) {
      if (err.status === 401 || err.status === 403) {
        return fail("unauthorized", "API 키가 거부되었습니다 — 키가 만료되었거나 잘못되었습니다.");
      }
      if (err.status === 404) {
        return fail("formNotFound", "폼을 찾을 수 없습니다 — 폼 ID를 확인하세요.");
      }
      return fail("requestFailed", `Walla가 오류를 반환했습니다 (${err.status}).`);
    }
    // 알 수 없는 오류의 원문에는 키가 섞여 있을 수 있어 그대로 흘리지 않는다.
    return fail("unreachable", "Walla에 연결하지 못했습니다 — 네트워크를 확인하세요.");
  }

  const detected = new Set(buildHiddenFieldMap(fields).values());

  return {
    ok: true,
    fieldCount: fields.length,
    utmKeys: UTM_KEYS.filter((key) => detected.has(key)),
    missingUtmKeys: UTM_KEYS.filter((key) => !detected.has(key)),
  };
}
