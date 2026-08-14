"use client";
import { useEffect, useState } from "react";
import type { Reel } from "@/lib/schemas";
import { ReelList } from "@/components/ReelList";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { filterByMedia, type MediaFilter } from "@/lib/ui/mediaFilter";
import type { EarlyViewsMap } from "@/lib/ui/reelSelect";

interface Props {
  title: string;
  description: string;
  /** 이 화면이 다루는 게시물 종류. 탭이 곧 필터라 화면에서 바꾸지 않는다. */
  filter: MediaFilter;
}

/**
 * 게시물 목록 한 화면.
 *
 * 릴스와 캐러셀은 같은 `/api/reels` 응답을 종류로만 갈라 보여 준다. 페이지를 둘로
 * 나눈 건 탭 하나가 한 종류만 책임지게 하려는 것이지, 데이터가 달라서가 아니다.
 */
export function MediaFeed({ title, description, filter }: Props) {
  const [reels, setReels] = useState<Reel[]>([]);
  const [earlyViews, setEarlyViews] = useState<EarlyViewsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
        <p className="text-sm text-neutral-600">{description}</p>
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
          reels={filterByMedia(reels, filter)}
          filter={filter}
          earlyViews={earlyViews}
        />
      )}
    </main>
  );
}
