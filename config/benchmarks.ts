export type MetricKey =
  | "hookRetention3s"
  | "completionRate"
  | "shareRate"
  | "saveRate"
  | "likeRate"
  | "commentRate"
  | "followRate"
  | "nonFollowerReach";

export interface Threshold {
  weakBelow: number;   // 이 값 미만이면 🔴 약점
  strongAbove: number; // 이 값 초과면 🟢 강점
  weight: number;      // 병목 우선순위 가중치
  label: string;       // UI 표기 (한국어)
}

// 스펙 5절 임계값 표 — 여기가 유일한 출처. 튜닝은 이 파일에서만.
export const BENCHMARKS: Record<MetricKey, Threshold> = {
  hookRetention3s: { weakBelow: 45, strongAbove: 55, weight: 5, label: "3초 훅 잔존" },
  completionRate:  { weakBelow: 30, strongAbove: 50, weight: 3, label: "평균 시청 비율" },
  shareRate:       { weakBelow: 0.4, strongAbove: 0.8, weight: 4, label: "공유율" },
  saveRate:        { weakBelow: 0.3, strongAbove: 0.6, weight: 3, label: "저장율" },
  likeRate:        { weakBelow: 1.5, strongAbove: 3, weight: 1, label: "좋아요율" },
  commentRate:     { weakBelow: 0.1, strongAbove: 0.3, weight: 2, label: "댓글율" },
  followRate:       { weakBelow: 0.4, strongAbove: 0.8, weight: 4, label: "팔로우 전환율" },
  nonFollowerReach: { weakBelow: 60, strongAbove: 80, weight: 3, label: "논팔로워 도달" },
};

export const DROP_THRESHOLD_PCT_PER_SEC = 8; // 잔존곡선 급락 플래그 기준 (%p/초)
export const HOOK_WINDOW_SEC = 3;            // 0~3초 훅 이탈은 별도 보고
export const BASELINE_MIN_REELS = 5;         // 개인화 베이스라인 전환 최소 릴스 수
