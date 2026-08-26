"use client";
import type { Reel } from "@/lib/schemas";
import type { AnalyzeResult } from "@/lib/analysis/analyze";
import type { ReelKpiDeltas } from "@/lib/analysis/reelKpiDeltas";
import { MetricBars } from "@/components/MetricBars";
import { ReelAnalysisPanel } from "@/components/ReelAnalysisPanel";
import { ReelConversionFunnel } from "@/components/ReelConversionFunnel";
import { ReelDerivedMetrics } from "@/components/ReelDerivedMetrics";
import { ReelPerformanceDashboard } from "@/components/ReelPerformanceDashboard";
import { ReelVideoPlayer } from "@/components/ReelVideoPlayer";

interface Props {
  reel: Reel;
  analysis: AnalyzeResult;
  kpiDeltas?: ReelKpiDeltas;
  onChange: () => void;
}

/**
 * 릴스 상세. 캐러셀은 CarouselDetail이 따로 맡는다 — 영상 잔존을 전제로 한 진단과
 * 자막·훅 생성이 여기 다 걸려 있어 한 컴포넌트에 두면 종류 분기만 남는다.
 */
export function ReelDetail({ reel, analysis, kpiDeltas, onChange }: Props) {
  return (
    <>
      {/* 영상은 왼쪽, 분석은 오른쪽. 자막을 보면서 화면을 되짚을 수 있어야 한다. */}
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <ReelVideoPlayer reel={reel} onDownloaded={onChange} />
        <ReelAnalysisPanel
          reel={reel}
          analysis={reel.reelAnalysis ?? null}
          onAnalyze={() => runReelAction(`/api/reels/${reel.id}/analysis`, onChange)}
          onTranscribe={() => runReelAction(`/api/reels/${reel.id}/transcript/whisper`, onChange)}
          onImprove={() => runReelAction(`/api/reels/${reel.id}/improved-story`, onChange)}
        />
      </div>

      <ReelPerformanceDashboard reel={reel} deltas={kpiDeltas} />

      <MetricBars verdicts={analysis.diagnosis.verdicts} baselineActive={analysis.baselineActive} />
      <ReelDerivedMetrics reel={reel} />
      <ReelConversionFunnel reel={reel} />
      {/* 캡션은 맨 아래에 둬 긴 본문이 분석을 밀어내지 않게 한다. */}
      {reel.caption && (
        <p className="whitespace-pre-line rounded-card border border-border-subtle bg-surface-muted/50 p-3 text-sm leading-relaxed text-neutral-700">
          {reel.caption}
        </p>
      )}
    </>
  );
}

/**
 * 전사·분석처럼 "서버가 릴스를 고쳐 쓰는" 동작을 한 곳에 모은다.
 *
 * 실패하면 던져서 패널이 사유를 그대로 띄우게 한다 — 여기서 삼키면 버튼만
 * 멈춘 것처럼 보이고 무엇을 고쳐야 하는지 알 수 없다.
 */
async function runReelAction(path: string, onDone: () => void): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `요청이 실패했습니다 (${res.status})`);
  }
  onDone();
}
