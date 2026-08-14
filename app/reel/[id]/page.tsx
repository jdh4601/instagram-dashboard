"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Film } from "lucide-react";
import type { Reel, ReelMetricSnapshot } from "@/lib/schemas";
import type { AnalyzeResult } from "@/lib/analysis/analyze";
import type { ReelKpiDeltas } from "@/lib/analysis/reelKpiDeltas";
import { reelTitle } from "@/lib/ui/reelTitle";
import { mediaKindOf } from "@/lib/media/kind";
import { listPathForMedia } from "@/lib/ui/navigation";
import { MEDIA_FILTER_LABELS } from "@/lib/ui/mediaFilter";
import { Skeleton, EmptyState } from "@/components/ui";
import { BottleneckBanner } from "@/components/BottleneckBanner";
import { DiagnosisCards } from "@/components/DiagnosisCards";
import { MetricBars } from "@/components/MetricBars";
import { ReelMetricTrend } from "@/components/ReelMetricTrend";
import { SrtUploadCard } from "@/components/SrtUploadCard";
import { SolutionsPanel } from "@/components/SolutionsPanel";
import { AiGenerationPanel } from "@/components/AiGenerationPanel";
import { ReelDerivedMetrics } from "@/components/ReelDerivedMetrics";
import { DurationInput } from "@/components/DurationInput";
import { ReelConversionFunnel } from "@/components/ReelConversionFunnel";
import { InsightList } from "@/components/InsightList";
import { ReelPerformanceDashboard } from "@/components/ReelPerformanceDashboard";
import { ReelVideoPlayer } from "@/components/ReelVideoPlayer";
import { ReelAnalysisPanel } from "@/components/ReelAnalysisPanel";

interface DetailResponse {
  reel: Reel;
  analysis: AnalyzeResult;
  metricHistory: ReelMetricSnapshot[];
  kpiDeltas?: ReelKpiDeltas;
}

export default function ReelDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/reels/${id}`);
      if (!r.ok) {
        setError((await r.json()).error ?? "불러오기 실패");
        return;
      }
      setData(await r.json());
    } catch {
      setError("네트워크 오류");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      {/* 왔던 목록으로 되돌린다 — 릴스 상세는 릴스 탭으로, 캐러셀 상세는 캐러셀 탭으로.
          아직 불러오는 중이면 종류를 모르니 릴스 목록을 기본으로 둔다. */}
      <Link
        href={data ? listPathForMedia(mediaKindOf(data.reel)) : "/reels"}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-9"
      >
        <ArrowLeft size={14} /> {data ? MEDIA_FILTER_LABELS[mediaKindOf(data.reel)] : "릴스"} 목록
      </Link>

      {error && <EmptyState icon={<Film size={26} />} title={error} />}

      {!error && !data && (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {data && <ReelDetail key={id} {...data} onChange={load} />}
    </main>
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

function ReelDetail({
  reel,
  analysis,
  metricHistory,
  kpiDeltas,
  onChange,
}: DetailResponse & { onChange: () => void }) {
  // 자막과 훅·엔딩 생성은 영상 전제라 캐러셀에서는 의미가 없다.
  const isReel = mediaKindOf(reel) === "REELS";
  // 화면 문구는 전부 이 한 값에서 나온다. 리터럴을 흩뿌리면 캐러셀에 "릴스"가 샌다.
  const mediaLabel = isReel ? "릴스" : "캐러셀";

  return (
    <>
      {/* 헤더 — 릴스는 아래 플레이어가 썸네일을 대신하므로 여기서 겹쳐 그리지 않는다. */}
      <div className="flex gap-4">
        {!isReel && (
          <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-card border border-border-subtle bg-neutral-100">
            {reel.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reel.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-300">
                <Film size={26} />
              </div>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-snug text-neutral-900">{reelTitle(reel)}</h1>
          <p className="mt-1 text-sm text-neutral-500">{reel.postedAt.slice(0, 10)}</p>
          {reel.permalink && (
            <a
              href={reel.permalink}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-9"
            >
              <ExternalLink size={14} /> 인스타그램에서 보기
            </a>
          )}
        </div>
      </div>

      {/* 영상은 왼쪽, 분석은 오른쪽. 자막을 보면서 화면을 되짚을 수 있어야 한다. */}
      {isReel && (
        <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <ReelVideoPlayer reel={reel} onDownloaded={onChange} />
          <ReelAnalysisPanel
            reel={reel}
            analysis={reel.reelAnalysis ?? null}
            onAnalyze={() => runReelAction(`/api/reels/${reel.id}/analysis`, onChange)}
            onTranscribe={() =>
              runReelAction(`/api/reels/${reel.id}/transcript/whisper`, onChange)
            }
            onImprove={() => runReelAction(`/api/reels/${reel.id}/improved-story`, onChange)}
          />
        </div>
      )}

      <ReelPerformanceDashboard reel={reel} deltas={kpiDeltas} />

      {/* 진단 → 처방 → 실행 → 근거/상세 순으로 스토리를 전개한다. */}
      <BottleneckBanner
        bottleneck={analysis.diagnosis.bottleneck}
        delta={analysis.bottleneckDelta}
        insufficientSample={analysis.diagnosis.insufficientSample}
        reach={analysis.diagnosis.reach}
      />
      <DiagnosisCards
        strengths={analysis.diagnosis.strengths}
        weaknesses={analysis.diagnosis.weaknesses}
        mediaLabel={mediaLabel}
        insufficientSample={analysis.diagnosis.insufficientSample}
      />
      <SolutionsPanel prescriptions={analysis.prescriptions} />
      {isReel && <AiGenerationPanel reelId={reel.id} />}
      <InsightList title={`이 ${mediaLabel}의 핵심 인사이트`} insights={analysis.reelInsights} />
      <ReelMetricTrend history={metricHistory} />
      {isReel && (
        <SrtUploadCard
          reelId={reel.id}
          analysis={analysis.transcript}
          insights={reel.transcriptInsights}
          onChange={onChange}
        />
      )}
      {isReel && (
        <DurationInput
          reelId={reel.id}
          durationSec={reel.durationSec}
          avgWatchTimeSec={reel.avgWatchTimeSec}
          onChange={onChange}
        />
      )}
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
