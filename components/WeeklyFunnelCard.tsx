import { ArrowRight, UserPlus, UserRoundSearch } from "lucide-react";
import type { ConversionFunnel } from "@/lib/analysis/conversionFunnel";
import { FUNNEL_WINDOW_DAYS } from "@/lib/analysis/conversionFunnel";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  funnel: ConversionFunnel;
}

export function WeeklyFunnelCard({ funnel }: Props) {
  if (funnel.postCount === 0) return null;

  const missing = Math.max(funnel.postsMissingVisits, funnel.postsMissingFollows);

  return (
    <Card>
      <CardHeader
        title={`최근 ${FUNNEL_WINDOW_DAYS}일 전환 퍼널`}
        icon={<UserRoundSearch size={16} className="text-brand-600" />}
        action={<Badge>API + derived</Badge>}
      />
      <CardBody className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Step label="도달" value={fmtCount(funnel.reach)} />
          <ArrowRight size={16} className="shrink-0 text-neutral-300" aria-hidden="true" />
          <Step
            label="프로필 방문"
            value={funnel.profileVisits === null ? "-" : fmtCount(funnel.profileVisits)}
            sub={funnel.visitRate === null ? undefined : `도달의 ${fmtPct(funnel.visitRate)}`}
          />
          <ArrowRight size={16} className="shrink-0 text-neutral-300" aria-hidden="true" />
          <Step
            label="팔로우"
            value={funnel.follows === null ? "-" : fmtCount(funnel.follows)}
            sub={funnel.followRate === null ? undefined : `방문 후 ${fmtPct(funnel.followRate)}`}
            icon={<UserPlus size={14} />}
          />
        </div>
        <p className="text-xs text-neutral-400">
          최근 {FUNNEL_WINDOW_DAYS}일 게시물 {funnel.postCount}개 합산.
          여러 글을 본 사람은 중복 계산되므로 단계 간 전환율로 읽으세요.
          {missing > 0 && ` 지표가 없는 게시물 ${missing}개는 제외했습니다.`}
        </p>
      </CardBody>
    </Card>
  );
}

function Step({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-32 flex-1 rounded-lg bg-surface-muted p-3">
      <p className="flex items-center gap-1 text-xs text-neutral-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{value}</p>
      {sub && <p className="text-xs text-brand-600">{sub}</p>}
    </div>
  );
}
