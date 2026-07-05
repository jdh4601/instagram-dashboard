import { Activity, BookmarkPlus, Eye, Gauge, Repeat2, Share2, UserPlus } from "lucide-react";
import type { Reel } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { fmtPct, fmtSec } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

interface MetricItem {
  label: string;
  value: string;
  formula: string;
  icon: React.ReactNode;
}

export function ReelDerivedMetrics({ reel }: { reel: Reel }) {
  const rates = computeDerivedRates(reel);
  const items: Array<MetricItem | null> = [
    rates.interactionRateByReach === undefined ? null : { label: "도달 기반 참여율", value: fmtPct(rates.interactionRateByReach), formula: "총 상호작용 ÷ 도달", icon: <Activity size={15} /> },
    rates.highIntentRate === undefined ? null : { label: "저장·공유 의도율", value: fmtPct(rates.highIntentRate), formula: "(저장 + 공유) ÷ 도달", icon: <BookmarkPlus size={15} /> },
    rates.playsPerReachedAccount === undefined ? null : { label: "도달당 재생", value: `${rates.playsPerReachedAccount.toFixed(2)}회`, formula: "조회 ÷ 도달", icon: <Eye size={15} /> },
    rates.replayRate === undefined ? null : { label: "재시청률", value: fmtPct(rates.replayRate), formula: "재시청 ÷ 조회", icon: <Repeat2 size={15} /> },
    rates.averageWatchPercentage === undefined ? null : { label: "평균 시청 비율", value: fmtPct(rates.averageWatchPercentage), formula: `평균 ${fmtSec(reel.avgWatchTimeSec)} ÷ 영상 ${fmtSec(reel.durationSec)}`, icon: <Gauge size={15} /> },
    rates.profileVisitRate === undefined ? null : { label: "프로필 방문률", value: fmtPct(rates.profileVisitRate), formula: "프로필 방문 ÷ 도달", icon: <Share2 size={15} /> },
    rates.followConversionRate === undefined ? null : { label: "팔로우 전환율", value: fmtPct(rates.followConversionRate), formula: "팔로우 ÷ 도달", icon: <UserPlus size={15} /> },
  ];
  const visible = items.filter((item): item is MetricItem => item !== null);
  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader title="파생 성과 지표" icon={<Activity size={16} className="text-brand-600" />} action={<Badge>derived</Badge>} />
      <CardBody className="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
        {visible.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">{item.icon}{item.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{item.value}</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">{item.formula}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
