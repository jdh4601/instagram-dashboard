import { ArrowRight, UserRoundSearch } from "lucide-react";
import type { AccountFunnel } from "@/lib/analysis/accountFunnel";
import { ACCOUNT_FUNNEL_WINDOW_DAYS } from "@/lib/analysis/accountFunnel";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  funnel: AccountFunnel | null;
}

export function AccountFunnelCard({ funnel }: Props) {
  if (funnel === null) return null;

  return (
    <Card>
      <CardHeader
        title={`최근 ${ACCOUNT_FUNNEL_WINDOW_DAYS}일 팔로워 순증 분해`}
        icon={<UserRoundSearch size={16} className="text-brand-600" />}
        action={<Badge>계정 전체 기준</Badge>}
      />
      <CardBody className="space-y-2">
        <div className="flex items-center gap-1">
          <Stage label="도달" value={fmtCount(funnel.reach)} />
          <ArrowRight size={14} className="shrink-0 text-neutral-300" aria-hidden="true" />
          <Stage
            label="프로필 방문"
            value={funnel.profileViews === null ? "-" : fmtCount(funnel.profileViews)}
            sub={funnel.viewRate === null ? undefined : fmtPct(funnel.viewRate)}
          />
          <ArrowRight size={14} className="shrink-0 text-neutral-300" aria-hidden="true" />
          <Stage
            label="팔로우"
            value={funnel.follows === null ? "-" : fmtCount(funnel.follows)}
            sub={funnel.followRate === null ? undefined : fmtPct(funnel.followRate)}
          />
          <ArrowRight size={14} className="shrink-0 text-neutral-300" aria-hidden="true" />
          <Stage
            label="순증"
            value={funnel.netFollows === null ? "-" : fmtSigned(funnel.netFollows)}
            sub={funnel.unfollows === null ? undefined : `언팔 ${fmtCount(funnel.unfollows)}`}
            accent
          />
        </div>
        <p className="text-xs text-neutral-400">
          {funnel.date} 기준 · 게시물 귀속이 아닌 계정 전체 수치라 미디어 필터와 무관합니다.
        </p>
      </CardBody>
    </Card>
  );
}

function fmtSigned(value: number): string {
  return value > 0 ? `+${fmtCount(value)}` : fmtCount(value);
}

function Stage({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 text-center">
      <p className="text-xs text-neutral-500">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${accent ? "text-brand-600" : "text-neutral-900"}`}
      >
        {value}
      </p>
      <p className="min-h-4 text-xs text-neutral-400">{sub ?? ""}</p>
    </div>
  );
}
