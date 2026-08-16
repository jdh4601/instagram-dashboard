"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { AdEfficiencyTable } from "@/components/AdEfficiencyTable";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import type {
  AdEfficiencyRow,
  AdEfficiencySort,
  AdEfficiencyTotals,
  AdResultGroup,
} from "@/lib/analysis/adEfficiency";

interface AdsResponse {
  configured: boolean;
  rows?: AdEfficiencyRow[];
  groups?: AdResultGroup[];
  totals?: AdEfficiencyTotals | null;
  lookbackDays?: number;
  unmatchedAds?: number;
  manualCount?: number;
  apiConfigured?: boolean;
  apiError?: string | null;
  error?: string;
}

export default function AdsPage() {
  const [data, setData] = useState<AdsResponse | null>(null);
  const [sort, setSort] = useState<AdEfficiencySort>("spend");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextSort: AdEfficiencySort) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ads?sort=${nextSort}`);
      const json: AdsResponse = await res.json();
      if (!res.ok && !json.error) throw new Error(`광고 성과를 불러오지 못했습니다 (${res.status})`);
      setData(json);
      // API 실패는 치명적이지 않다 — 수동 기록은 그대로 보여 주고 경고만 얹는다.
      setError(json.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "광고 성과를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(sort);
  }, [load, sort]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-4 sm:px-6 sm:py-6">
      <header>
        <h1 className="text-lg font-semibold text-neutral-900">광고 효율</h1>
        <p className="mt-1 text-sm text-neutral-500">
          광고를 태운 게시물의 지출과 단가를 견줍니다. 결과 유형이 다르면 서로 다른 자라서
          표를 나눠 놓았습니다.
        </p>
      </header>

      {loading && data === null ? (
        <DashboardSkeleton />
      ) : (
        <Card>
          <CardHeader
            title="게시물별 광고 성과"
            icon={<Megaphone size={16} className="text-brand-500" />}
            action={loading ? <span className="text-xs text-neutral-400">불러오는 중…</span> : null}
          />
          <CardBody>
            <Body
              data={data}
              error={error}
              sort={sort}
              onSort={setSort}
            />
          </CardBody>
        </Card>
      )}
    </main>
  );
}

function Body({
  data,
  error,
  sort,
  onSort,
}: {
  data: AdsResponse | null;
  error: string | null;
  sort: AdEfficiencySort;
  onSort: (sort: AdEfficiencySort) => void;
}) {
  if (error) {
    return <EmptyState title="광고 성과를 불러오지 못했습니다" hint={error} />;
  }

  if (data === null) return null;

  if (!data.configured) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="Meta 광고가 연결되지 않았습니다"
          hint="설정에서 Marketing API 액세스 토큰과 광고 계정 id를 입력하면 게시물별 지출·단가가 채워집니다."
        />
        <Link
          href="/settings"
          className="inline-flex rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          설정으로 가기
        </Link>
      </div>
    );
  }

  const rows = data.rows ?? [];
  if (rows.length === 0) {
    return (
      // 실측으로 확인한 경로다. 자격증명이 멀쩡한데도 표가 비는 유일한 원인이라
      // 사용자가 헤매지 않도록 여기서 짚어 준다.
      <EmptyState
        title="인스타 게시물에 붙은 광고가 없습니다"
        hint="인스타그램 앱의 '홍보하기'로 만든 부스트는 Ad Center에 남아 Marketing API에 올라오지 않습니다. 광고 관리자(Ads Manager)에서 집행한 광고만 이 표에 잡힙니다."
      />
    );
  }

  return (
    <div className="space-y-3">
      {(data.unmatchedAds ?? 0) > 0 && (
        <p className="rounded-lg bg-band-ok-soft px-3 py-2 text-xs text-band-ok">
          광고 {data.unmatchedAds}건은 저장된 게시물과 잇지 못했습니다 — 동기화를 먼저 돌리면
          채워집니다.
        </p>
      )}
      {data.apiError && (
        <p className="rounded-lg bg-band-weak-soft px-3 py-2 text-xs text-band-weak">
          Marketing API를 읽지 못했습니다 ({data.apiError}) — 아래는 수동 기록만입니다.
        </p>
      )}
      <AdEfficiencyTable groups={data.groups ?? []} sort={sort} onSort={onSort} />
      {(data.manualCount ?? 0) > 0 && (
        <p className="text-xs leading-relaxed text-neutral-400">
          수동 기록 {data.manualCount}건이 포함돼 있습니다. 인스타그램 앱 &lsquo;홍보하기&rsquo;
          부스트는 Ad Center에만 남아 API로 가져올 수 없어 손으로 옮겨 적은 값입니다. Ad Center는
          광고에 달린 좋아요·저장을 알려주지 않아 참여 단가는 비어 있습니다.
        </p>
      )}
    </div>
  );
}
