"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, Film } from "lucide-react";
import type { Reel, ReelMetricSnapshot } from "@/lib/schemas";
import type { AnalyzeResult } from "@/lib/analysis/analyze";
import type { ReelKpiDeltas } from "@/lib/analysis/reelKpiDeltas";
import { reelTitle } from "@/lib/ui/reelTitle";
import { mediaKindOf } from "@/lib/media/kind";
import { Skeleton, EmptyState } from "@/components/ui";
import { BottleneckBanner } from "@/components/BottleneckBanner";
import { DiagnosisCards } from "@/components/DiagnosisCards";
import { MetricBars } from "@/components/MetricBars";
import { ReelMetricTrend } from "@/components/ReelMetricTrend";
import { SrtUploadCard } from "@/components/SrtUploadCard";
import { SolutionsPanel } from "@/components/SolutionsPanel";
import { AiGenerationPanel } from "@/components/AiGenerationPanel";
import { ReelDerivedMetrics } from "@/components/ReelDerivedMetrics";
import { ReelConversionFunnel } from "@/components/ReelConversionFunnel";
import { InsightList } from "@/components/InsightList";
import { ReelPerformanceDashboard } from "@/components/ReelPerformanceDashboard";

interface ReelNav {
  prevId: string | null;
  nextId: string | null;
}

interface DetailResponse {
  reel: Reel;
  analysis: AnalyzeResult;
  metricHistory: ReelMetricSnapshot[];
  kpiDeltas?: ReelKpiDeltas;
  nav?: ReelNav;
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
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-9"
      >
        <ArrowLeft size={14} /> 대시보드
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

function ReelDetail({
  reel,
  analysis,
  metricHistory,
  kpiDeltas,
  nav,
  onChange,
}: DetailResponse & { onChange: () => void }) {
  // 자막과 훅·엔딩 생성은 영상 전제라 캐러셀에서는 의미가 없다.
  const isReel = mediaKindOf(reel) === "REELS";

  return (
    <>
      {/* 이전·다음 이동 */}
      {(nav?.prevId || nav?.nextId) && (
        <div className="flex items-center justify-between text-sm">
          {nav?.prevId ? (
            <Link
              href={`/reel/${nav.prevId}`}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg text-neutral-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-9"
            >
              <ArrowLeft size={14} /> 이전 {isReel ? "릴스" : "캐러셀"}
            </Link>
          ) : (
            <span />
          )}
          {nav?.nextId ? (
            <Link
              href={`/reel/${nav.nextId}`}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg text-neutral-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-9"
            >
              다음 {isReel ? "릴스" : "캐러셀"} <ArrowRight size={14} />
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex gap-4">
        <div className={`relative ${isReel ? "aspect-[9/16] w-24" : "aspect-square w-24"} shrink-0 overflow-hidden rounded-card border border-border-subtle bg-neutral-100`}>
          {reel.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={reel.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-300">
              <Film size={26} />
            </div>
          )}
        </div>
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

      <ReelPerformanceDashboard reel={reel} deltas={kpiDeltas} />

      {/* 진단 → 처방 → 실행 → 근거/상세 순으로 스토리를 전개한다. */}
      <BottleneckBanner bottleneck={analysis.diagnosis.bottleneck} delta={analysis.bottleneckDelta} />
      <DiagnosisCards
        strengths={analysis.diagnosis.strengths}
        weaknesses={analysis.diagnosis.weaknesses}
      />
      <SolutionsPanel prescriptions={analysis.prescriptions} />
      {isReel && <AiGenerationPanel reelId={reel.id} />}
      <InsightList title={`이 ${isReel ? "릴스" : "캐러셀"}의 핵심 인사이트`} insights={analysis.reelInsights} />
      <ReelMetricTrend history={metricHistory} />
      {isReel && (
        <SrtUploadCard
          reelId={reel.id}
          analysis={analysis.transcript}
          insights={reel.transcriptInsights}
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
