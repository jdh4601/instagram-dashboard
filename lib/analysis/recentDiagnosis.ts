import type { MediaKind, Reel } from "@/lib/schemas";
import { BENCHMARKS_BY_KIND, type MetricKey, type Threshold } from "@/config/benchmarks";
import { mediaKindOf } from "@/lib/media/kind";
import { classifyBand, type MetricVerdict } from "@/lib/analysis/diagnosis";
import { computeDerivedRates } from "@/lib/analysis/metrics";

export const RECENT_REEL_COUNT = 10;

const KIND_LABEL: Record<MediaKind, string> = { REELS: "릴스", CAROUSEL: "캐러셀" };

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

export function diagnoseRecent(reels: Reel[], kind: MediaKind = "REELS"): RecentDiagnosis {
  const sameKind = reels.filter((reel) => mediaKindOf(reel) === kind);
  const recent = recentReels(sameKind, RECENT_REEL_COUNT);
  // INS-10(B안): 계정 레벨 진단은 개인 베이스라인이 아니라 업계 절대 기준을 쓴다.
  // 베이스라인(내 중앙값 ×0.85)을 쓰면 계정 전체가 기준 미달인 지표(예: 캐러셀 저장율)가
  // 자기 평균은 넘겨 영원히 약점으로 안 뜬다. 게시물 상세(diagnose)는 게시물 간 변별을
  // 위해 여전히 베이스라인을 쓰고, 절대 기준은 이 계정 레벨 집계에만 둔다.
  const thresholds = BENCHMARKS_BY_KIND[kind];
  const verdicts: MetricVerdict[] = [];

  for (const key of Object.keys(thresholds) as MetricKey[]) {
    const threshold = thresholds[key];
    if (threshold === undefined) continue;
    const values = metricValues(recent, key);
    if (values.length === 0) continue;
    const avg = average(values);
    verdicts.push(buildVerdict(key, avg, threshold));
  }

  const strengths = verdicts.filter((v) => v.band === "strong");
  const weaknesses = verdicts.filter((v) => v.band === "weak");

  const summary = buildSummary(strengths, weaknesses, recent.length, KIND_LABEL[kind]);

  return { verdicts, strengths, weaknesses, reelCount: recent.length, summary };
}

function buildSummary(
  strengths: MetricVerdict[],
  weaknesses: MetricVerdict[],
  reelCount: number,
  label: string,
): string {
  if (strengths.length === 0 && weaknesses.length === 0) {
    return `최근 ${label} 데이터가 부족해요.`;
  }

  const parts: string[] = [];
  if (strengths.length > 0) {
    parts.push(`강점 ${strengths.length}개`);
  }
  if (weaknesses.length > 0) {
    parts.push(`개선이 필요한 지표 ${weaknesses.length}개`);
  }

  const main = parts.join(", ");
  return `최근 ${reelCount}개 ${label} 기준: ${main}.`;
}
