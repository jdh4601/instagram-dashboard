"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdUnitDetail } from "@/components/AdUnitDetail";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { EmptyState } from "@/components/ui";
import type { AdUnit } from "@/lib/ads/adUnit";
import type { Reel } from "@/lib/schemas";

interface DetailResponse {
  unit?: AdUnit;
  post?: Reel | null;
  error?: string;
}

export default function AdUnitPage({ params }: { params: Promise<{ adId: string }> }) {
  const { adId } = use(params);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/ads/units/${encodeURIComponent(adId)}`);
        const json: DetailResponse = await res.json();
        if (!alive) return;
        // 라우트가 404와 502를 가른다. 못 읽은 것을 없는 것으로 말하지 않으려는 것이라
        // 여기서도 그 문구를 그대로 옮긴다.
        if (!res.ok) throw new Error(json.error ?? `광고를 불러오지 못했습니다 (${res.status})`);
        setData(json);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "광고를 불러오지 못했습니다");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [adId]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-4 sm:px-6 sm:py-6">
      <Link
        href="/ads"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <ArrowLeft size={14} aria-hidden />
        광고 목록
      </Link>

      {loading ? (
        <DashboardSkeleton />
      ) : error !== null || !data?.unit ? (
        <EmptyState
          title="광고를 불러오지 못했습니다"
          hint={error ?? "이 광고를 찾지 못했습니다."}
        />
      ) : (
        <>
          <header>
            <h1 className="text-lg font-semibold text-neutral-900">{data.unit.name}</h1>
          </header>
          <AdUnitDetail unit={data.unit} post={data.post ?? null} />
        </>
      )}
    </main>
  );
}
