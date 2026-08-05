import type { WallaProbeResult } from "@/lib/walla/probe";
import type { UtmKey } from "@/lib/walla/map";

export interface WallaProbeNotice {
  tone: "success" | "warning" | "error";
  message: string;
}

/** 화면에는 대시보드 내부 축 이름이 아니라 사용자가 폼에 적는 라벨로 보여 준다. */
function labelOf(key: UtmKey): string {
  return `utm_${key}`;
}

function listOf(keys: UtmKey[]): string {
  return keys.map(labelOf).join(", ");
}

/**
 * 연결 테스트 결과 → 사용자에게 보여 줄 알림.
 *
 * 인증 성공을 곧바로 "성공"으로 옮기지 않는다. medium 숨김 필드가 없으면 바이오
 * 유입을 가려낼 수 없어 신청 전환율이 계속 0%로 남는데, 그 상태는 화면에서
 * "연동 완료"와 구분되지 않아 원인을 되짚기가 어렵다.
 */
export function describeWallaProbe(result: WallaProbeResult): WallaProbeNotice {
  if (!result.ok) return { tone: "error", message: result.message };

  const head = `연결됨 — 필드 ${result.fieldCount}개`;

  if (result.utmKeys.length === 0) {
    return {
      tone: "warning",
      message: `${head}, UTM 숨김 필드가 없어 신청 수만 집계됩니다`,
    };
  }

  if (result.missingUtmKeys.length === 0) {
    return { tone: "success", message: `${head}, UTM 숨김 필드 ${result.utmKeys.length}개 모두 인식됨` };
  }

  // medium은 applyRate의 분자(바이오 유입)를 가르는 축이라 없으면 전환율 자체가 안 나온다.
  if (result.missingUtmKeys.includes("medium")) {
    return {
      tone: "warning",
      message: `${head}, ${listOf(result.missingUtmKeys)} 없음 — utm_medium이 없으면 신청 전환율이 나오지 않습니다`,
    };
  }

  return { tone: "success", message: `${head}, ${listOf(result.missingUtmKeys)} 없음` };
}
