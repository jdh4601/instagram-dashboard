import {
  BENCHMARKS_BY_KIND,
  type MetricKey,
  type Threshold,
  type ThresholdTable,
} from "@/config/benchmarks";
import type { Reel } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { mediaKindOf } from "@/lib/media/kind";

export type Band = "weak" | "ok" | "strong";

export interface MetricVerdict {
  key: MetricKey;
  label: string;
  value: number;
  band: Band;
  priorityScore: number;
  threshold: Threshold; // band를 만든 임계값 — 시각화(마커)가 라벨과 같은 자를 쓰게 함
}

export interface Diagnosis {
  verdicts: MetricVerdict[];
  strengths: MetricVerdict[];
  weaknesses: MetricVerdict[];
  bottleneck: MetricVerdict | null;
}

export function classifyBand(value: number, t: Threshold): Band {
  if (value < t.weakBelow) return "weak";
  if (value > t.strongAbove) return "strong";
  return "ok";
}

// MetricKey → 해당 릴스의 측정값(없으면 undefined)
function metricValues(reel: Reel): Partial<Record<MetricKey, number>> {
  const d = computeDerivedRates(reel);
  return {
    hookRetention3s: reel.hookRetention3s,
    // 영상 길이를 모르면(0) 완료율은 계산 불가 → verdict에서 제외
    completionRate: reel.durationSec > 0 ? d.completionRate : undefined,
    shareRate: d.shareRate,
    saveRate: d.saveRate,
    likeRate: d.likeRate,
    commentRate: d.commentRate,
    followRate: d.followRate,
    nonFollowerReach: reel.audienceBreakdown?.nonFollowersPct,
    profileVisitRate: d.profileVisitRate,
  };
}

function priorityScore(value: number, t: Threshold): number {
  const gap = Math.max(0, (t.weakBelow - value) / t.weakBelow);
  return t.weight * gap;
}

export function diagnose(
  reel: Reel,
  thresholds: ThresholdTable = BENCHMARKS_BY_KIND[mediaKindOf(reel)],
): Diagnosis {
  const values = metricValues(reel);
  const verdicts: MetricVerdict[] = [];

  for (const key of Object.keys(thresholds) as MetricKey[]) {
    const value = values[key];
    const t = thresholds[key];
    if (value === undefined || t === undefined) continue;
    const band = classifyBand(value, t);
    verdicts.push({
      key,
      label: t.label,
      value,
      band,
      priorityScore: band === "weak" ? priorityScore(value, t) : 0,
      threshold: t,
    });
  }

  const strengths = verdicts.filter((v) => v.band === "strong");
  const weaknesses = verdicts.filter((v) => v.band === "weak");
  const bottleneck =
    weaknesses.length === 0
      ? null
      : weaknesses.reduce((a, b) => (b.priorityScore > a.priorityScore ? b : a));

  return { verdicts, strengths, weaknesses, bottleneck };
}
