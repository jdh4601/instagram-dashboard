import { Users, Eye, Film, Heart, UserPlus, UserRoundCheck } from "lucide-react";
import { Stat } from "@/components/ui";
import { fmtPct } from "@/lib/ui/format";
import type { AccountOverview as Overview } from "@/lib/analysis/accountOverview";

interface AccountOverviewProps {
  overview: Overview;
}

function followerHint(delta: number | null): string {
  if (delta === null) return "추이 데이터 부족";
  if (delta === 0) return "직전 대비 변화 없음";
  const sign = delta > 0 ? "▲" : "▼";
  return `직전 대비 ${sign}${Math.abs(delta).toLocaleString()}`;
}

export function AccountOverview({ overview }: AccountOverviewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat
        label="팔로워"
        value={overview.followers.toLocaleString()}
        icon={<Users size={16} />}
        hint={followerHint(overview.followerDelta)}
      />
      <Stat
        label="7일 도달"
        value={overview.reachAvailable ? overview.reachLast7d.toLocaleString() : "-"}
        icon={<Eye size={16} />}
        hint={overview.reachAvailable ? "API 계정 인사이트" : "API 미지원 또는 미수집"}
      />
      <Stat
        label="7일 조회"
        value={overview.viewsLast7d === null ? "-" : overview.viewsLast7d.toLocaleString()}
        icon={<Film size={16} />}
        hint={overview.viewsLast7d === null ? "API 미지원 또는 미수집" : "전체 콘텐츠 조회"}
      />
      <Stat
        label="참여 계정"
        value={overview.accountsEngagedLast7d === null ? "-" : overview.accountsEngagedLast7d.toLocaleString()}
        icon={<UserRoundCheck size={16} />}
        hint={overview.accountsEngagedLast7d === null ? "API 미지원 또는 미수집" : "최근 7일"}
      />
      <Stat
        label="총 상호작용"
        value={overview.totalInteractionsLast7d === null ? "-" : overview.totalInteractionsLast7d.toLocaleString()}
        icon={<Heart size={16} />}
        hint={overview.totalInteractionsLast7d === null ? `릴스 평균 ${fmtPct(overview.avgEngagementRate)}` : "최근 7일"}
      />
      <Stat
        label="팔로우 전환율"
        value={overview.followConversionRateLast7d === null ? "-" : fmtPct(overview.followConversionRateLast7d)}
        icon={<UserPlus size={16} />}
        hint={
          overview.followConversionRateLast7d === null
            ? "팔로우 또는 도달 데이터 없음"
            : overview.followConversionSource === "api"
              ? "7일 팔로우 ÷ 7일 도달"
              : "7일 순증 팔로워 ÷ 7일 도달 · 추정"
        }
      />
    </div>
  );
}
