import type { AudienceMix } from "@/lib/analysis/audienceMix";
import { fmtCount, fmtPct } from "@/lib/ui/format";

interface Props {
  mix: AudienceMix;
}

/**
 * 도달 한 덩어리를 팔로워와 비팔로워로 쪼개 보여 주는 섹션.
 *
 * 카드 껍데기를 두르지 않는다 — 업로드 리듬 카드 안에 얹혀 산다. "얼마나 새로
 * 닿았나"와 "얼마나 꾸준히 올렸나"는 같은 질문의 앞뒤라 한 카드에서 같이 읽힌다.
 *
 * 좋아요·저장·공유 구성비(도넛)도 여기 있었지만 걷어냈다. 비율만으로는 어느
 * 게시물을 어떻게 고칠지가 나오지 않아 읽고 나서 할 일이 없었다.
 */
export function ReachMixSection({ mix }: Props) {
  const followerShare = 100 - mix.nonFollowerShare;

  return (
    <section aria-label="도달 구성" className="space-y-2">
      <p className="text-xs font-medium text-neutral-500">도달 구성 (팔로워 vs 비팔로워)</p>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={`비팔로워 도달 ${fmtPct(mix.nonFollowerShare)}, 팔로워 도달 ${fmtPct(followerShare)}`}
      >
        <div className="bg-brand-500" style={{ width: `${mix.nonFollowerShare}%` }} />
        <div className="bg-neutral-300" style={{ width: `${followerShare}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Stat
          label="비팔로워 (신규 도달)"
          value={fmtCount(mix.nonFollowerReach)}
          share={mix.nonFollowerShare}
          accent
        />
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
    <div className="min-w-28 flex-1 rounded-lg bg-surface-muted p-2.5">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900">{value}</p>
      <p className={`text-xs ${accent ? "text-brand-600" : "text-neutral-400"}`}>{fmtPct(share)}</p>
    </div>
  );
}
