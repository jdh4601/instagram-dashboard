"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { AdEfficiencyTable } from "@/components/AdEfficiencyTable";
import { AdEfficiencyFilters, type AdFilterState } from "@/components/AdEfficiencyFilters";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import {
  filterAdEfficiency,
  hasMixedResultTypes,
  sumAdEfficiency,
  type AdEfficiencyRow,
  type AdEfficiencySort,
} from "@/lib/analysis/adEfficiency";

interface AdsResponse {
  configured: boolean;
  rows?: AdEfficiencyRow[];
  lookbackDays?: number;
  unmatchedAds?: number;
  manualCount?: number;
  apiConfigured?: boolean;
  apiError?: string | null;
  error?: string;
}

/**
 * 게시물별 광고 효율.
 *
 * 광고별 목록과 축이 다르다. 한 게시물을 여러 번 태운 것을 합쳐 견주는 자리라,
 * 광고 하나하나의 상태나 목표는 여기서 다루지 않는다.
 */
export function AdEfficiencyPanel() {
  const [data, setData] = useState<AdsResponse | null>(null);
  const [sort, setSort] = useState<AdEfficiencySort>("spend");
  const [filter, setFilter] = useState<AdFilterState>({});
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

  if (loading && data === null) return <DashboardSkeleton />;

  return (
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
          filter={filter}
          onFilter={setFilter}
        />
      </CardBody>
    </Card>
  );
}

function Body({
  data,
  error,
  sort,
  onSort,
  filter,
  onFilter,
}: {
  data: AdsResponse | null;
  error: string | null;
  sort: AdEfficiencySort;
  onSort: (sort: AdEfficiencySort) => void;
  filter: AdFilterState;
  onFilter: (next: AdFilterState) => void;
}) {
  const allRows = useMemo(() => data?.rows ?? [], [data]);
  const rows = useMemo(() => filterAdEfficiency(allRows, filter), [allRows, filter]);
  const resultTypes = useMemo(
    () =>
      [...new Set(allRows.map((row) => row.resultType))].filter(
        (type): type is string => type !== null,
      ),
    [allRows],
  );

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

  if (allRows.length === 0) {
    return (
      // 실측으로 확인한 경로다. 자격증명이 멀쩡한데도 표가 비는 유일한 원인이라
      // 사용자가 헤매지 않도록 여기서 짚어 준다.
      <EmptyState
        title="인스타 게시물에 붙은 광고가 없습니다"
        hint="인스타그램 앱의 '홍보하기'로 만든 부스트는 Ad Center에 남아 Marketing API에 올라오지 않습니다. 광고 관리자(Ads Manager)에서 집행한 광고만 이 표에 잡힙니다."
      />
    );
  }

  const mixed = hasMixedResultTypes(rows);

  return (
    <div className="space-y-3">
      <AdEfficiencyFilters
        filter={filter}
        onFilter={onFilter}
        sort={sort}
        onSort={onSort}
        availableResultTypes={resultTypes}
        shown={rows.length}
        total={allRows.length}
      />

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
      {/* 단가 정렬은 유형이 섞이면 거짓 순위를 만든다. 목표 칩으로 좁히라고 짚어 준다. */}
      {mixed && sort === "costPerResult" && (
        <p className="rounded-lg bg-band-ok-soft px-3 py-2 text-xs text-band-ok">
          목표가 다른 광고가 섞여 있습니다 — 프로필 방문과 링크 클릭은 난이도가 달라 단가를
          그대로 견주면 안 됩니다. 위 &ldquo;목표&rdquo;에서 하나만 골라 보세요.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState title="고른 조건에 맞는 광고가 없습니다" hint="필터를 넓혀 보세요." />
      ) : (
        <AdEfficiencyTable
          rows={rows}
          totals={sumAdEfficiency(rows)}
          sort={sort}
          onSort={onSort}
          mixedResultTypes={mixed}
        />
      )}

      {(data.manualCount ?? 0) > 0 && (
        <p className="text-xs leading-relaxed text-neutral-400">
          <strong className="font-medium text-neutral-500">결과</strong>는 부스트할 때 고른 목표의
          달성 수입니다 — 목표가 &lsquo;프로필 방문&rsquo;이면 방문 수, &lsquo;웹사이트
          방문&rsquo;이면 링크 클릭 수라 서로 다른 행동을 셉니다. 수동 기록 {data.manualCount}건은
          인스타그램 앱 &lsquo;홍보하기&rsquo; 부스트라 Ad Center에서 손으로 옮겨 적었습니다. Ad
          Center는 광고에 달린 좋아요·저장을 알려주지 않습니다.
        </p>
      )}
    </div>
  );
}
