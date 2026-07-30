import type { Reel } from "@/lib/schemas";
import { diagnose, type Diagnosis } from "@/lib/analysis/diagnosis";
import { buildPlaybook, type Prescription } from "@/lib/recommend/playbook";
import { buildBaselineThresholds, deltaVsRecent } from "@/lib/analysis/baseline";
import { analyzeTranscript, type TranscriptAnalysis } from "@/lib/analysis/transcriptAnalysis";
import { BENCHMARKS_BY_KIND, type MetricKey } from "@/config/benchmarks";
import { buildReelInsights } from "@/lib/analysis/reelInsights";
import type { MetricInsight } from "@/lib/analysis/insightTypes";
import { mediaKindOf } from "@/lib/media/kind";

export interface AnalyzeResult {
  diagnosis: Diagnosis;
  prescriptions: Prescription[];
  baselineActive: boolean;
  bottleneckDelta: number | null; // 병목 지표의 최근 3개 대비 델타
  transcript: TranscriptAnalysis;  // SRT 자막 분석 (자막 없으면 lineCount 0)
  reelInsights: MetricInsight[];
}

export function analyzeReel(reel: Reel, history: Reel[]): AnalyzeResult {
  // history는 호출부에서 같은 미디어 종류로 걸러 들어온다(app/api/reels/[id]/route.ts).
  const kind = mediaKindOf(reel);
  const baseline = buildBaselineThresholds(history, kind);
  const thresholds = baseline ?? BENCHMARKS_BY_KIND[kind];
  const diagnosis = diagnose(reel, thresholds);
  const prescriptions = buildPlaybook(diagnosis);
  const transcript = analyzeTranscript(reel);
  const reelInsights = buildReelInsights(reel, history);

  const recent = history.slice(-3);
  const bottleneckDelta = diagnosis.bottleneck
    ? deltaVsRecent(reel, recent, diagnosis.bottleneck.key as MetricKey)
    : null;

  return { diagnosis, prescriptions, baselineActive: baseline !== null, bottleneckDelta, transcript, reelInsights };
}
