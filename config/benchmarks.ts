import type { MediaKind } from "@/lib/schemas";

export type MetricKey =
  | "hookRetention3s"
  | "completionRate"
  | "shareRate"
  | "saveRate"
  | "likeRate"
  | "commentRate"
  | "followRate"
  | "profileVisitRate";

/** 릴스 표가 반드시 갖는 키. 영상 전용 분석이 undefined 검사 없이 쓸 수 있다. */
export type ReelMetricKey = Exclude<MetricKey, "profileVisitRate">;

export interface Threshold {
  weakBelow: number;   // 이 값 미만이면 🔴 약점
  strongAbove: number; // 이 값 초과면 🟢 강점
  weight: number;      // 병목 우선순위 가중치
  label: string;       // UI 표기 (한국어)
}

/** 포맷마다 존재하는 지표가 다르므로 표는 부분집합이다. */
export type ThresholdTable = Partial<Record<MetricKey, Threshold>>;

// 스펙 5절 임계값 표 — 여기가 유일한 출처. 튜닝은 이 파일에서만.
export const REELS_BENCHMARKS: Record<ReelMetricKey, Threshold> = {
  hookRetention3s: { weakBelow: 45, strongAbove: 55, weight: 5, label: "3초 훅 잔존" },
  completionRate:  { weakBelow: 30, strongAbove: 50, weight: 3, label: "평균 시청 비율" },
  shareRate:       { weakBelow: 0.4, strongAbove: 0.8, weight: 4, label: "공유율" },
  saveRate:        { weakBelow: 0.3, strongAbove: 0.6, weight: 3, label: "저장율" },
  likeRate:        { weakBelow: 1.5, strongAbove: 3, weight: 1, label: "좋아요율" },
  commentRate:     { weakBelow: 0.1, strongAbove: 0.3, weight: 2, label: "댓글율" },
  followRate:       { weakBelow: 0.4, strongAbove: 0.8, weight: 4, label: "팔로우 전환율" },
};

// 캐러셀은 도달을 늘리는 포맷이 아니라 이미 닿은 사람을 팬으로 바꾸는 포맷이다.
// 그래서 1순위가 저장율이고(다시 꺼내 볼 가치), 그 다음이 프로필 방문율이다.
// 영상 지표(hookRetention3s, completionRate)는 개념 자체가 없어 아예 넣지 않는다.
//
// 분모는 전부 도달이다. 캐러셀의 views는 노출이라 도달의 3배 안팎으로 부푼다 —
// 자세한 이유는 lib/analysis/metrics.ts의 metricValue 주석에 있다. 라벨에 (도달)을
// 달아 두는 건 화면에서 릴스 표(조회수 분모)와 헷갈리지 않게 하려는 것이다.
//
// 좋아요·댓글 기준은 릴스 표에서 그대로 베껴 온 값이었다. 도달 분모로 옮기면 거의
// 모든 게시물이 강점으로 뜨는 무의미한 자가 되어(좋아요율 중앙값 3.5%) 실측 32건의
// 사분위로 다시 잡았다. 저장·공유·프로필 방문·팔로우는 원래 도달 기준 업계 추정치라
// 숫자를 그대로 둔다.
export const CAROUSEL_BENCHMARKS: ThresholdTable = {
  saveRate:         { weakBelow: 1, strongAbove: 2, weight: 5, label: "저장율(도달)" },
  profileVisitRate: { weakBelow: 1, strongAbove: 2, weight: 4, label: "프로필 방문율(도달)" },
  followRate:       { weakBelow: 0.4, strongAbove: 0.8, weight: 4, label: "팔로우 전환율(도달)" },
  shareRate:        { weakBelow: 0.8, strongAbove: 2, weight: 3, label: "공유율(도달)" },
  commentRate:      { weakBelow: 0.2, strongAbove: 0.6, weight: 2, label: "댓글율(도달)" },
  likeRate:         { weakBelow: 2, strongAbove: 5, weight: 1, label: "좋아요율(도달)" },
};

export const BENCHMARKS_BY_KIND: Record<MediaKind, ThresholdTable> = {
  REELS: REELS_BENCHMARKS,
  CAROUSEL: CAROUSEL_BENCHMARKS,
};

/**
 * 릴스 표의 별칭. 영상 전용 분석(자막·잔존곡선·릴스 차트)은 릴스만 다루므로
 * 이 상수를 직접 읽는다. 포맷을 가리지 않는 진단은 BENCHMARKS_BY_KIND를 쓸 것.
 */
export const BENCHMARKS = REELS_BENCHMARKS;

// 계정 레벨 퍼널(도달→방문→팔로우/링크클릭) 판정 기준.
// 출처가 확인된 값이 아니라 일반적으로 알려진 인스타그램 업계 벤치마크 추정치다.
// 게시물 단위 REELS_BENCHMARKS/CAROUSEL_BENCHMARKS와는 분모가 달라 별도 테이블로 둔다.
export type AccountFunnelMetricKey = "viewRate" | "followRate" | "linkClickRate";

export const ACCOUNT_FUNNEL_BENCHMARKS: Record<AccountFunnelMetricKey, Threshold> = {
  viewRate:      { weakBelow: 1, strongAbove: 3, weight: 1, label: "계정 방문률" },
  followRate:    { weakBelow: 2, strongAbove: 5, weight: 1, label: "팔로우 전환율" },
  linkClickRate: { weakBelow: 1, strongAbove: 3, weight: 1, label: "링크 클릭률" },
};

export const HOOK_WINDOW_SEC = 3;            // 0~3초 훅 이탈은 별도 보고
export const BASELINE_MIN_REELS = 5;         // 개인화 베이스라인 전환 최소 릴스 수

// 강점·약점·병목을 판정할 최소 도달. 진단은 비율만 보는데 도달이 작으면 분모가
// 작아 비율이 오히려 좋게 나온다. 표본이 적을수록 "강점"이 쉬워지는 역설을 막는다.
// 실측 사례: 도달 108건 캐러셀이 "뚜렷한 병목 없음"으로 판정됐다.
export const MIN_REACH_FOR_VERDICT = 300;
