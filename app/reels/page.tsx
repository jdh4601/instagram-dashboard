"use client";
import { useEffect, useState } from "react";
import type { Reel } from "@/lib/schemas";
import { ReelList } from "@/components/ReelList";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { filterByMedia, type MediaFilter } from "@/lib/ui/mediaFilter";
import type { EarlyViewsMap } from "@/lib/ui/reelSelect";

export default function ReelsPage() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [earlyViews, setEarlyViews] = useState<EarlyViewsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 기본값 릴스 — 대시보드와 같은 기준으로 시작한다.
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("REELS");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/reels");
        if (!res.ok) throw new Error(`게시물을 불러오지 못했습니다 (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setReels(data.reels ?? []);
        setEarlyViews(data.earlyViews ?? {});
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "게시물을 불러오지 못했습니다");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">릴스</h1>
        <p className="text-sm text-neutral-600">게시물을 검색·정렬하고 상세 분석으로 들어갑니다.</p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-band-weak-soft px-3 py-2 text-sm text-band-weak">
          {error}
        </p>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <ReelList
          reels={filterByMedia(reels, mediaFilter)}
          filter={mediaFilter}
          onFilterChange={setMediaFilter}
          earlyViews={earlyViews}
        />
      )}
    </main>
  );
}
