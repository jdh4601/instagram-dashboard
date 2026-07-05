import type { Reel } from "@/lib/schemas";
import { diagnose, type Diagnosis } from "@/lib/analysis/diagnosis";
import type { DropSegment } from "@/lib/analysis/dropDetection";
import { buildPlaybook, type Prescription } from "@/lib/recommend/playbook";
import { buildBaselineThresholds, deltaVsRecent } from "@/lib/analysis/baseline";
import { analyzeTranscript, type TranscriptAnalysis } from "@/lib/analysis/transcriptAnalysis";
import { BENCHMARKS, type MetricKey } from "@/config/benchmarks";
import { buildReelInsights } from "@/lib/analysis/reelInsights";
import type { MetricInsight } from "@/lib/analysis/insightTypes";

export interface AnalyzeResult {
  diagnosis: Diagnosis;
  drops: DropSegment[];
  prescriptions: Prescription[];
  baselineActive: boolean;
  bottleneckDelta: number | null; // 병목 지표의 최근 3개 대비 델타
  transcript: TranscriptAnalysis;  // SRT 자막 분석 (자막 없으면 lineCount 0)
  reelInsights: MetricInsight[];
}

export function analyzeReel(reel: Reel, history: Reel[]): AnalyzeResult {
  const baseline = buildBaselineThresholds(history);
  const thresholds = baseline ?? BENCHMARKS;
  const diagnosis = diagnose(reel, thresholds);
  const drops: DropSegment[] = [];
  const prescriptions = buildPlaybook(diagnosis, drops);
  const transcript = analyzeTranscript(reel, drops);
  const reelInsights = buildReelInsights(reel, history);

  const recent = history.slice(-3);
  const bottleneckDelta = diagnosis.bottleneck
    ? deltaVsRecent(reel, recent, diagnosis.bottleneck.key as MetricKey)
    : null;

  return { diagnosis, drops, prescriptions, baselineActive: baseline !== null, bottleneckDelta, transcript, reelInsights };
}
