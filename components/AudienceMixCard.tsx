import { Users } from "lucide-react";
import type { AudienceMix } from "@/lib/analysis/audienceMix";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  mix: AudienceMix | null;
}

// 비팔로워 비중이 낮다 = 도달이 대부분 기존 팬 안에서 돈다. 신규 유입 관점에서 나쁜 신호다.
const HEALTHY_NON_FOLLOWER_SHARE = 60;

export function AudienceMixCard({ mix }: Props) {
  if (mix === null) return null;

  const followerShare = 100 - mix.nonFollowerShare;
  const reachesNew = mix.nonFollowerShare >= HEALTHY_NON_FOLLOWER_SHARE;

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
        <p className="text-xs text-neutral-400">
          최근 7일 도달 {fmtCount(mix.total)}명 중 비팔로워 {fmtPct(mix.nonFollowerShare)}.{" "}
          {reachesNew
            ? "도달의 절반 이상이 신규다 — 콘텐츠가 계정 밖으로 퍼지고 있습니다."
            : "도달 대부분이 기존 팔로워 안에서 돕니다. 신규 유입을 늘리려면 공유·저장을 부르는 훅이 필요합니다."}
        </p>
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
