import {
  Eye,
  Film,
  Heart,
  Minus,
  TrendingDown,
  TrendingUp,
  UserPlus,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Stat } from "@/components/ui";
import { fmtPct } from "@/lib/ui/format";
import type {
  AccountOverview as Overview,
  MetricDelta,
} from "@/lib/analysis/accountOverview";

interface AccountOverviewProps {
  overview: Overview;
}

interface DeltaHintProps {
  delta: MetricDelta | null;
  fallback: string;
  percentagePoints?: boolean;
}

function DeltaHint({ delta, fallback, percentagePoints = false }: DeltaHintProps) {
  if (delta === null) return <>{fallback}</>;

  const { absolute, relativePercent } = delta;
  if (absolute === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-neutral-500">
        <Minus size={12} aria-hidden="true" />
        직전 대비 변화 없음
      </span>
    );
  }

  const increased = absolute > 0;
  const Icon = increased ? TrendingUp : TrendingDown;
  const sign = increased ? "+" : "−";
  const absoluteLabel = percentagePoints
    ? `${Math.abs(absolute).toFixed(2)}%p`
    : Math.abs(absolute).toLocaleString();
  const relativeLabel = !percentagePoints && relativePercent !== null
    ? ` (${sign}${Math.abs(relativePercent).toFixed(1)}%)`
    : "";

  return (
    <span
      className={
        increased
          ? "inline-flex items-center gap-1 text-band-strong"
          : "inline-flex items-center gap-1 text-band-weak"
      }
    >
      <Icon size={12} aria-hidden="true" />
      직전 대비 {sign}{absoluteLabel}{relativeLabel}
    </span>
  );
}

export function AccountOverview({ overview }: AccountOverviewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat
        label="팔로워"
        value={overview.followers.toLocaleString()}
        icon={<Users size={16} />}
        hint={<DeltaHint delta={overview.deltas.followers} fallback="직전 비교 데이터 없음" />}
      />
      <Stat
        label="7일 도달"
        value={overview.reachAvailable ? overview.reachLast7d.toLocaleString() : "-"}
        icon={<Eye size={16} />}
        hint={
          <DeltaHint
            delta={overview.deltas.reachLast7d}
            fallback={overview.reachAvailable ? "직전 비교 데이터 없음" : "API 미지원 또는 미수집"}
          />
        }
      />
      <Stat
        label="7일 조회"
        value={overview.viewsLast7d === null ? "-" : overview.viewsLast7d.toLocaleString()}
        icon={<Film size={16} />}
        hint={
          <DeltaHint
            delta={overview.deltas.viewsLast7d}
            fallback={overview.viewsLast7d === null ? "API 미지원 또는 미수집" : "직전 비교 데이터 없음"}
          />
        }
      />
      <Stat
        label="참여 계정"
        value={overview.accountsEngagedLast7d === null ? "-" : overview.accountsEngagedLast7d.toLocaleString()}
        icon={<UserRoundCheck size={16} />}
        hint={
          <DeltaHint
            delta={overview.deltas.accountsEngagedLast7d}
            fallback={overview.accountsEngagedLast7d === null ? "API 미지원 또는 미수집" : "직전 비교 데이터 없음"}
          />
        }
      />
      <Stat
        label="총 상호작용"
        value={overview.totalInteractionsLast7d === null ? "-" : overview.totalInteractionsLast7d.toLocaleString()}
        icon={<Heart size={16} />}
        hint={
          <DeltaHint
            delta={overview.deltas.totalInteractionsLast7d}
            fallback={
              overview.totalInteractionsLast7d === null
                ? `게시물 평균 ${fmtPct(overview.avgEngagementRate)}`
                : "직전 비교 데이터 없음"
            }
          />
        }
      />
      <Stat
        label="팔로우 전환율"
        value={overview.followConversionRateLast7d === null ? "-" : fmtPct(overview.followConversionRateLast7d)}
        icon={<UserPlus size={16} />}
        hint={
          <DeltaHint
            delta={overview.deltas.followConversionRateLast7d}
            fallback={
              overview.followConversionRateLast7d === null
                ? "팔로우 또는 도달 데이터 없음"
                : "직전 비교 데이터 없음"
            }
            percentagePoints
          />
        }
      />
    </div>
  );
}
