import { ArrowRight, UserPlus, UserRoundSearch } from "lucide-react";
import type { Reel } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

export function ReelConversionFunnel({ reel }: { reel: Reel }) {
  if (reel.profileVisits === undefined && reel.followsFromReel === undefined) return null;
  const rates = computeDerivedRates(reel);
  return (
    <Card>
      <CardHeader title="프로필 전환 퍼널" icon={<UserRoundSearch size={16} className="text-brand-600" />} action={<Badge>API + derived</Badge>} />
      <CardBody>
        <div className="flex flex-wrap items-center gap-3">
          <FunnelStep label="도달" value={fmtCount(reel.reach)} />
          <ArrowRight size={16} className="text-neutral-300" />
          <FunnelStep label="프로필 방문" value={reel.profileVisits === undefined ? "-" : fmtCount(reel.profileVisits)} sub={rates.profileVisitRate === undefined ? undefined : fmtPct(rates.profileVisitRate)} />
          <ArrowRight size={16} className="text-neutral-300" />
          <FunnelStep label="팔로우" value={reel.followsFromReel === undefined ? "-" : fmtCount(reel.followsFromReel)} sub={rates.profileToFollowRate === undefined ? undefined : `방문 후 ${fmtPct(rates.profileToFollowRate)}`} icon={<UserPlus size={14} />} />
        </div>
      </CardBody>
    </Card>
  );
}

function FunnelStep({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-32 flex-1 rounded-lg bg-surface-muted p-3">
      <p className="flex items-center gap-1 text-xs text-neutral-500">{icon}{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{value}</p>
      {sub && <p className="text-xs text-brand-600">{sub}</p>}
    </div>
  );
}
