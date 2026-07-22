import type { Reel } from "@/lib/schemas";
import { BENCHMARKS, type MetricKey, type Threshold } from "@/config/benchmarks";
import { classifyBand, type Band, type MetricVerdict } from "@/lib/analysis/diagnosis";
import { buildBaselineThresholds } from "@/lib/analysis/baseline";
import { computeDerivedRates } from "@/lib/analysis/metrics";

export const RECENT_REEL_COUNT = 10;

export interface RecentDiagnosis {
  /** 최근 N개 릴스에서 평균 성과가 strong/weak/ok 인 지표 */
  verdicts: MetricVerdict[];
  strengths: MetricVerdict[];
  weaknesses: MetricVerdict[];
  /** 최근 릴스 수 */
  reelCount: number;
  /** 요약 한 줄 */
  summary: string;
}

function recentReels(reels: Reel[], count: number): Reel[] {
  return [...reels]
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .slice(0, count);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function metricValues(reels: Reel[], key: MetricKey): number[] {
  return reels
    .map((r) => {
      if (key === "hookRetention3s") return r.hookRetention3s;
      if (key === "completionRate") {
        // 영상 길이를 모르면(0) 완료율은 계산 불가
        if (r.durationSec <= 0) return undefined;
      }
      const d = computeDerivedRates(r);
      return d[key as keyof typeof d];
    })
    .filter((v): v is number => typeof v === "number");
}

function buildVerdict(key: MetricKey, value: number, t: Threshold): MetricVerdict {
  const band = classifyBand(value, t);
  return {
    key,
    label: t.label,
    value,
    band,
    priorityScore: band === "weak" ? t.weight * Math.max(0, (t.weakBelow - value) / t.weakBelow) : 0,
    threshold: t,
  };
}

export function diagnoseRecent(reels: Reel[]): RecentDiagnosis {
  const recent = recentReels(reels, RECENT_REEL_COUNT);
  // A안: 상세(analyzeReel)와 동일한 임계값 소스 — 베이스라인(내 평균), 부족 시 글로벌
  const thresholds = buildBaselineThresholds(reels) ?? BENCHMARKS;
  const verdicts: MetricVerdict[] = [];

  for (const key of Object.keys(thresholds) as MetricKey[]) {
    const values = metricValues(recent, key);
    if (values.length === 0) continue;
    const avg = average(values);
    verdicts.push(buildVerdict(key, avg, thresholds[key]));
  }

  const strengths = verdicts.filter((v) => v.band === "strong");
  const weaknesses = verdicts.filter((v) => v.band === "weak");

  const summary = buildSummary(strengths, weaknesses, recent.length);

  return { verdicts, strengths, weaknesses, reelCount: recent.length, summary };
}

function buildSummary(strengths: MetricVerdict[], weaknesses: MetricVerdict[], reelCount: number): string {
  if (strengths.length === 0 && weaknesses.length === 0) {
    return "최근 릴스 데이터가 부족해요.";
  }

  const parts: string[] = [];
  if (strengths.length > 0) {
    parts.push(`강점 ${strengths.length}개`);
  }
  if (weaknesses.length > 0) {
    parts.push(`개선이 필요한 지표 ${weaknesses.length}개`);
  }

  const main = parts.join(", ");
  return `최근 ${reelCount}개 릴스 기준: ${main}.`;
}
