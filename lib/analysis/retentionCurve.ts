import type { Reel, RetentionPoint } from "@/lib/schemas";

export interface RetentionCurveResult {
  /** 잔존 곡선 좌표(초→잔존율%) */
  curve: RetentionPoint[];
  /** true면 API skip rate로 만든 추정 곡선(실측 아님) */
  estimated: boolean;
}

// 잔존 곡선 소스 우선순위:
// 1) 스크린샷 실측 retentionCurve가 있으면 그대로 사용(초 단위 실데이터)
// 2) 없으면 API skip rate로 (0초=100%, 3초=100-skipRate) 2점 추정 곡선
//    → Graph API는 초당 곡선을 안 주므로 3초 훅까지만 정직하게 표현
export function buildRetentionCurve(reel: Reel): RetentionCurveResult {
  if (reel.retentionCurve && reel.retentionCurve.length > 0) {
    return { curve: reel.retentionCurve, estimated: false };
  }

  const hook =
    reel.hookRetention3s ?? (reel.skipRate != null ? 100 - reel.skipRate : undefined);
  if (hook === undefined) {
    return { curve: [], estimated: false };
  }

  return {
    curve: [
      { sec: 0, pct: 100 },
      { sec: 3, pct: Number(hook.toFixed(2)) },
    ],
    estimated: true,
  };
}
