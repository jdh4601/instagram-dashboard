"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Film } from "lucide-react";
import type { MediaKind, Reel, ReelMetricSnapshot } from "@/lib/schemas";
import type { AnalyzeResult } from "@/lib/analysis/analyze";
import type { ReelKpiDeltas } from "@/lib/analysis/reelKpiDeltas";
import { reelTitle } from "@/lib/ui/reelTitle";
import { mediaKindOf } from "@/lib/media/kind";
import { detailPathForMedia, listPathForMedia } from "@/lib/ui/navigation";
import { MEDIA_FILTER_LABELS } from "@/lib/ui/mediaFilter";
import { Skeleton, EmptyState } from "@/components/ui";
import { CarouselDetail } from "@/components/CarouselDetail";
import { ReelDetail } from "@/components/ReelDetail";

interface DetailResponse {
  reel: Reel;
  analysis: AnalyzeResult;
  metricHistory: ReelMetricSnapshot[];
  kpiDeltas?: ReelKpiDeltas;
}

interface Props {
  id: string;
  /** 이 경로가 맡는 종류. 다른 종류가 오면 그 종류의 상세로 넘긴다. */
  kind: MediaKind;
}

/**
 * 게시물 상세의 공통 껍데기 — 불러오기, 뒤로 가기, 머리글까지만 맡는다.
 *
 * 본문은 종류마다 다른 컴포넌트가 그린다. 경로도 종류마다 갈라져 있어(/reel/:id,
 * /carousel/:id) 사이드바가 왔던 목록 탭을 켤 수 있다.
 */
export function MediaDetailScreen({ id, kind }: Props) {
  const router = useRouter();
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

  // 옛 링크·북마크(캐러셀인데 /reel/:id)는 제 경로로 돌려보낸다. 그대로 두면 화면은
  // 캐러셀인데 사이드바는 릴스 탭이 켜진다.
  const actualKind = data ? mediaKindOf(data.reel) : null;
  useEffect(() => {
    if (actualKind && actualKind !== kind) router.replace(detailPathForMedia(actualKind, id));
  }, [actualKind, kind, id, router]);

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      {/* 왔던 목록으로 되돌린다 — 릴스 상세는 릴스 탭으로, 캐러셀 상세는 캐러셀 탭으로. */}
      <Link
        href={listPathForMedia(actualKind ?? kind)}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-9"
      >
        <ArrowLeft size={14} /> {MEDIA_FILTER_LABELS[actualKind ?? kind]} 목록
      </Link>

      {error && <EmptyState icon={<Film size={26} />} title={error} />}

      {!error && !data && (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {data && (
        <>
          <PostHeader reel={data.reel} />
          {actualKind === "CAROUSEL" ? (
            <CarouselDetail key={id} reel={data.reel} analysis={data.analysis} kpiDeltas={data.kpiDeltas} />
          ) : (
            <ReelDetail key={id} {...data} onChange={load} />
          )}
        </>
      )}
    </main>
  );
}

function PostHeader({ reel }: { reel: Reel }) {
  return (
    <div className="min-w-0">
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
  );
}
