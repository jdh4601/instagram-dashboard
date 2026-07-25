import { Users } from "lucide-react";
import type { AudienceMix } from "@/lib/analysis/audienceMix";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  mix: AudienceMix | null;
}

export function AudienceMixCard({ mix }: Props) {
  if (mix === null) return null;

  const followerShare = 100 - mix.nonFollowerShare;

  return (
    <Card>
      <CardHeader
        title="도달 구성 (팔로워 vs 비팔로워)"
        icon={<Users size={16} className="text-brand-600" />}
        action={<Badge>{mix.date} 기준</Badge>}
      />
      <CardBody className="space-y-3">
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-surface-muted"
          role="img"
          aria-label={`비팔로워 도달 ${fmtPct(mix.nonFollowerShare)}, 팔로워 도달 ${fmtPct(followerShare)}`}
        >
          <div className="bg-brand-500" style={{ width: `${mix.nonFollowerShare}%` }} />
          <div className="bg-neutral-300" style={{ width: `${followerShare}%` }} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Stat label="비팔로워 (신규 도달)" value={fmtCount(mix.nonFollowerReach)} share={mix.nonFollowerShare} accent />
          <Stat label="팔로워 (기존 팬)" value={fmtCount(mix.followerReach)} share={followerShare} />
        </div>
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  share,
  accent,
}: {
  label: string;
  value: string;
  share: number;
  accent?: boolean;
}) {
  return (
    <div className="min-w-32 flex-1 rounded-lg bg-surface-muted p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{value}</p>
      <p className={`text-xs ${accent ? "text-brand-600" : "text-neutral-400"}`}>{fmtPct(share)}</p>
    </div>
  );
}
