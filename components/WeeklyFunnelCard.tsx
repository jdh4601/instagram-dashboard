import { ArrowRight, UserRoundSearch } from "lucide-react";
import type { ConversionFunnel } from "@/lib/analysis/conversionFunnel";
import { FUNNEL_WINDOW_DAYS } from "@/lib/analysis/conversionFunnel";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Card, CardBody, CardHeader } from "@/components/ui";

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
      />
      <CardBody className="space-y-2">
        <div className="flex items-center gap-1">
          <Stage label="도달" value={fmtCount(funnel.reach)} />
          <ArrowRight size={14} className="shrink-0 text-neutral-300" aria-hidden="true" />
          <Stage
            label="프로필 방문"
            value={funnel.profileVisits === null ? "-" : fmtCount(funnel.profileVisits)}
            sub={funnel.visitRate === null ? undefined : fmtPct(funnel.visitRate)}
          />
          <ArrowRight size={14} className="shrink-0 text-neutral-300" aria-hidden="true" />
          <Stage
            label="팔로우"
            value={funnel.follows === null ? "-" : fmtCount(funnel.follows)}
            sub={funnel.followRate === null ? undefined : fmtPct(funnel.followRate)}
          />
        </div>
        {missing > 0 && (
          <p className="text-xs text-neutral-400">
            게시물 {funnel.postCount}개 중 {missing}개는 방문·팔로우 미측정.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function Stage({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-lg font-bold tabular-nums text-neutral-900">{value}</p>
      <p className="min-h-4 text-xs text-brand-600">{sub ?? ""}</p>
    </div>
  );
}
