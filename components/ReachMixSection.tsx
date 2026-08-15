import { Users } from "lucide-react";
import type { AudienceMix } from "@/lib/analysis/audienceMix";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  mix: AudienceMix | null;
}

/**
 * 도달 한 덩어리를 팔로워와 비팔로워로 쪼개 보여 준다.
 *
 * 좋아요·저장·공유 구성비(도넛)도 여기 있었지만 걷어냈다. 비율만으로는 어느
 * 게시물을 어떻게 고칠지가 나오지 않아 읽고 나서 할 일이 없었다.
 *
 * 데이터 신선도는 동기화 버튼 옆에서 한 번만 말한다. 카드마다 "... 기준"을 붙이면
 * 같은 이야기가 화면 곳곳에서 반복돼 정작 숫자가 묻힌다.
 */
export function AudienceMixCard({ mix }: Props) {
  if (mix === null) return null;

  return (
    <Card>
      <CardHeader
        title="도달 구성 (팔로워 vs 비팔로워)"
        icon={<Users size={16} className="text-brand-600" />}
      />
      <CardBody>
        <ReachMix mix={mix} />
      </CardBody>
    </Card>
  );
}

function ReachMix({ mix }: { mix: AudienceMix }) {
  const followerShare = 100 - mix.nonFollowerShare;

  return (
    <section aria-label="도달 구성" className="space-y-3">
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
