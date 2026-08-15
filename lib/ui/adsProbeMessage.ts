import type { AdsProbeResult } from "@/lib/ads/probe";
import { fmtWon } from "@/lib/ui/format";

export interface AdsProbeNotice {
  tone: "success" | "warning" | "error";
  message: string;
}

/**
 * 연결 테스트 결과 → 사용자에게 보여 줄 알림.
 *
 * 인증 성공을 곧바로 "성공"으로 옮기지 않는다. 토큰이 살아 있어도 인스타 게시물에
 * 붙은 광고가 없으면 효율 표는 영영 비어 있는데, 그 상태는 화면에서 "연동 완료"와
 * 구분되지 않아 원인을 되짚기가 어렵다. 실측에서 이미 겪은 경로다 — 앱 '홍보하기'로
 * 만든 부스트는 Ad Center에 남아 표준 광고 객체로 올라오지 않는다.
 */
export function describeAdsProbe(result: AdsProbeResult, lookbackDays?: number): AdsProbeNotice {
  if (!result.ok) return { tone: "error", message: result.message };

  const window = lookbackDays ? `최근 ${lookbackDays}일 ` : "";

  if (result.emptyAccount) {
    return {
      tone: "warning",
      message:
        `연결됨 — 그런데 ${window}인스타 게시물에 붙은 광고가 0건입니다. ` +
        `앱 '홍보하기'로 만든 부스트는 Marketing API에 올라오지 않습니다 (광고 관리자에서 집행한 것만 잡힙니다)`,
    };
  }

  return {
    tone: "success",
    message:
      `연결됨 — ${window}게시물 ${result.postCount}건 · 광고 ${result.linkedAdCount}건 · ` +
      `지출 ${fmtWon(result.spend)}`,
  };
}
