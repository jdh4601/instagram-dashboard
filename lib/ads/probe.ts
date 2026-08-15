import { AdsRequestError, type AdsClient } from "@/lib/ads/client";

interface AdsProbeOk {
  ok: true;
  /** 기간 내 광고 수(인스타 게시물에 붙은 것만) */
  linkedAdCount: number;
  /** 광고가 붙은 게시물 수 */
  postCount: number;
  /** 기간 내 총 지출 */
  spend: number;
  /**
   * 광고는 있는데 인스타 게시물에 하나도 붙지 않은 상태.
   *
   * 앱 '홍보하기'로 만든 부스트가 Ad Center에 남아 표준 광고 객체로 올라오지
   * 않으면 여기가 true가 된다. 자격증명은 멀쩡한데 표가 비는 유일한 경우라
   * 따로 구분해서 알려 줘야 사용자가 원인을 찾을 수 있다.
   */
  emptyAccount: boolean;
}

type AdsProbeFailReason =
  /** 토큰이 거부됨 — 사용자가 고칠 곳은 토큰이다. */
  | "unauthorized"
  /** 토큰은 통과했는데 계정에 닿지 못함 — 고칠 곳은 광고 계정 id 또는 권한이다. */
  | "accountNotFound"
  /** Marketing API가 오류 상태로 답함. */
  | "requestFailed"
  /** 요청 자체가 나가지 못함(네트워크·DNS). */
  | "unreachable";

interface AdsProbeFail {
  ok: false;
  reason: AdsProbeFailReason;
  /** 화면에 그대로 띄우는 문구. 자격증명을 담지 않는다. */
  message: string;
}

export type AdsProbeResult = AdsProbeOk | AdsProbeFail;

function fail(reason: AdsProbeFailReason, message: string): AdsProbeFail {
  return { ok: false, reason, message };
}

// 만료·위조 토큰
const AUTH_CODES = new Set([190, 102]);
// 권한 없음 / 없는 객체
const PERMISSION_CODES = new Set([100, 200, 803]);

/**
 * 저장하기 전에 자격증명이 실제로 통하는지 확인한다.
 *
 * 인증만 보고 끝내지 않는다. 토큰이 살아 있어도 광고가 인스타 게시물에 붙어
 * 있지 않으면 효율 표는 영영 비어 있는데, 그 상태를 동기화를 여러 번 돌린 뒤에
 * 발견하면 원인을 되짚기 어렵다. 실측에서 이미 한 번 겪은 경로다.
 */
export async function probeAdsConnection(
  client: AdsClient,
  adAccountId: string,
  range: { since: string; until: string },
): Promise<AdsProbeResult> {
  try {
    const rows = await client.listAdPerformance(adAccountId, range);
    const linkedAdCount = rows.reduce((sum, row) => sum + row.adCount, 0);
    return {
      ok: true,
      linkedAdCount,
      postCount: rows.length,
      spend: rows.reduce((sum, row) => sum + row.spend, 0),
      emptyAccount: rows.length === 0,
    };
  } catch (err) {
    if (err instanceof AdsRequestError) {
      if (err.code !== undefined && AUTH_CODES.has(err.code)) {
        return fail("unauthorized", "액세스 토큰이 거부되었습니다 — 만료되었거나 잘못된 토큰입니다.");
      }
      if (err.code !== undefined && PERMISSION_CODES.has(err.code)) {
        return fail(
          "accountNotFound",
          "광고 계정에 접근할 수 없습니다 — 계정 id와 ads_read 권한을 확인하세요.",
        );
      }
      return fail("requestFailed", "Marketing API가 오류를 반환했습니다.");
    }
    // 알 수 없는 오류의 원문에는 토큰이 섞여 있을 수 있어 그대로 흘리지 않는다.
    return fail("unreachable", "Marketing API에 연결하지 못했습니다 — 네트워크를 확인하세요.");
  }
}
