import { Users } from "lucide-react";
import type { AudienceMix } from "@/lib/analysis/audienceMix";
import type { Reel } from "@/lib/schemas";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { EngagementDonut } from "@/components/EngagementDonut";

interface Props {
  mix: AudienceMix | null;
  reels: Reel[];
}

/**
 * 도달의 "누구"(팔로워 vs 비팔로워)와 "무엇"(공유·댓글·저장·좋아요)을 한 카드에 둔다.
 * 둘 다 도달 한 덩어리를 쪼개 보는 구성비라 나란히 놓으면 같이 읽힌다.
 *
 * 단, 기준이 다르다: 도달 구성은 계정 레벨 스냅샷이고 인게이지먼트 구성은 현재
 * 필터가 걸린 게시물 합계다. 그래서 섹션마다 기준을 따로 밝힌다.
 */
export function AudienceMixCard({ mix, reels }: Props) {
  if (mix === null && reels.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="도달 · 인게이지먼트 구성"
        icon={<Users size={16} className="text-brand-600" />}
        action={mix === null ? undefined : <Badge>{mix.date} 기준</Badge>}
      />
      <CardBody className="space-y-4">
        {mix !== null && <ReachMix mix={mix} />}
        <section
          aria-label="인게이지먼트 구성"
          className={mix === null ? undefined : "border-t border-border-subtle pt-4"}
        >
          <SectionLabel title="인게이지먼트 구성" note="표시된 게시물 기준" />
          <div className="mt-2">
            <EngagementDonut reels={reels} />
          </div>
        </section>
      </CardBody>
    </Card>
  );
}

function ReachMix({ mix }: { mix: AudienceMix }) {
  const followerShare = 100 - mix.nonFollowerShare;

  return (
    <section aria-label="도달 구성" className="space-y-3">
      <SectionLabel title="도달 구성 (팔로워 vs 비팔로워)" note="계정 전체 기준" />
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
    </section>
  );
}

function SectionLabel({ title, note }: { title: string; note: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-xs font-medium text-neutral-500">
      {title}
      <span className="text-[11px] font-normal text-neutral-400">{note}</span>
    </p>
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
