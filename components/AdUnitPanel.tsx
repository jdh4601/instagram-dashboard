"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { AdUnitList } from "@/components/AdUnitList";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import type { AdUnit } from "@/lib/ads/adUnit";

interface UnitsResponse {
  configured: boolean;
  units: AdUnit[];
  lookbackDays: number;
  error: string | null;
}

/** 광고 한 건이 한 줄인 목록. Business Suite의 광고 화면과 같은 축이다. */
export function AdUnitPanel() {
  const [data, setData] = useState<UnitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/ads/units");
        const json: UnitsResponse = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(`광고를 불러오지 못했습니다 (${res.status})`);
        setData(json);
        setError(json.error);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "광고를 불러오지 못했습니다");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <DashboardSkeleton />;

  return (
    <Card>
      <CardHeader
        title="집행한 광고"
        icon={<Megaphone size={16} className="text-brand-500" />}
        action={
          data?.lookbackDays ? (
            <span className="text-xs text-neutral-400">최근 {data.lookbackDays}일</span>
          ) : null
        }
      />
      <CardBody>
        <Body data={data} error={error} />
      </CardBody>
    </Card>
  );
}

function Body({ data, error }: { data: UnitsResponse | null; error: string | null }) {
  if (error) return <EmptyState title="광고를 불러오지 못했습니다" hint={error} />;
  if (data === null) return null;

  // 미설정과 "설정했는데 0건"은 사용자가 할 일이 달라서 화면이 구분해야 한다.
  if (!data.configured) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="Meta 광고가 연결되지 않았습니다"
          hint="설정에서 Marketing API 액세스 토큰과 광고 계정 id를 입력하면 집행한 광고가 채워집니다."
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

  return <AdUnitList units={data.units} />;
}
