import {
  BENCHMARKS_BY_KIND,
  BASELINE_MIN_REELS,
  type MetricKey,
  type ThresholdTable,
} from "@/config/benchmarks";
import type { MediaKind, Reel } from "@/lib/schemas";
import { metricValue } from "@/lib/analysis/metrics";

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// 진단과 같은 분모로 읽어야 기준과 판정이 어긋나지 않는다 — metricValue 주석 참고.
const valueOf = metricValue;

export function buildBaselineThresholds(
  history: Reel[],
  kind: MediaKind = "REELS",
): ThresholdTable | null {
  if (history.length < BASELINE_MIN_REELS) return null;

  const globals = BENCHMARKS_BY_KIND[kind];
  const result: ThresholdTable = {};

  for (const key of Object.keys(globals) as MetricKey[]) {
    const global = globals[key];
    if (global === undefined) continue;

    const values = history
      .map((r) => valueOf(r, key))
      .filter((v): v is number => v !== undefined);

    if (values.length < BASELINE_MIN_REELS) {
      result[key] = global; // 이 지표는 데이터 부족 → 글로벌 유지
      continue;
    }
    const m = median(values);
    result[key] = {
      ...global,
      weakBelow: m * 0.85,
      // 강점에는 절대 하한을 건다. 개인 중앙값만 쓰면 계정 전체가 기준 미달일 때
      // 자기 평균보다 조금 나은 게시물이 "강점"으로 뜬다. 실제로 캐러셀 저장율
      // 중앙값이 0.15%라 0.64%짜리가 강점으로 판정됐다 — 업계 합격선은 1%다.
      //
      // 약점 판정은 개인 기준을 그대로 둬 게시물 간 비교력을 유지한다.
      strongAbove: Math.max(m * 1.15, global.weakBelow),
    };
  }
  return result;
}

export function deltaVsRecent(
  reel: Reel,
  recent: Reel[],
  key: MetricKey,
): number | null {
  const current = valueOf(reel, key);
  if (current === undefined) return null;

  const recentValues = recent
    .map((r) => valueOf(r, key))
    .filter((v): v is number => v !== undefined);
  if (recentValues.length === 0) return null;

  const avg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  return current - avg;
}
