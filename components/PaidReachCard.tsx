import { Megaphone } from "lucide-react";
import type { PaidMix, PaidSplit } from "@/lib/analysis/paidMix";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  /** 광고/오가닉 구성. breakdown을 수집하기 전 스냅샷뿐이면 null이라 카드가 사라진다. */
  mix: PaidMix | null;
}

const ROWS: Array<{ key: keyof Pick<PaidMix, "reach" | "views" | "interactions">; label: string; hint: string }> = [
  { key: "reach", label: "도달", hint: "본 사람 수" },
  { key: "views", label: "조회수", hint: "재생·노출 횟수" },
  { key: "interactions", label: "상호작용", hint: "좋아요·저장·댓글·공유" },
];

/**
 * 최근 7일 성과를 광고로 산 몫과 오가닉으로 가르는 카드.
 *
 * 게시물 상세에는 이 구분이 없다 — Instagram Login 토큰으로는 게시물 레벨 광고 지표
 * (total_views·boost_ads_list)가 막혀 있어 계정 레벨 media_product_type breakdown이
 * 유일한 경로다. 그래서 "이 캐러셀의 광고 조회수"가 아니라 "계정 전체의 광고 조회수"다.
 */
export function PaidReachCard({ mix }: Props) {
  if (mix === null) return null;

  return (
    <Card>
      <CardHeader
        title="광고로 산 성과 (최근 7일)"
        icon={<Megaphone size={16} className="text-brand-500" />}
        action={
          <span className="text-xs text-neutral-500">
            {mix.hasPaid ? `기준일 ${mix.date}` : "광고 집행 없음"}
          </span>
        }
      />
      <CardBody className="space-y-4">
        {ROWS.map(({ key, label, hint }) => {
          const split = mix[key];
          if (split === undefined) return null;
          return <SplitRow key={key} label={label} hint={hint} split={split} />;
        })}
        {/* 이 숫자를 게시물 상세의 조회수와 더하면 안 된다는 것만은 반드시 말해 둔다. */}
        <p className="text-xs leading-relaxed text-neutral-400">
          계정 전체 기준입니다. 게시물별 광고 성과는 Instagram이 이 토큰에 열어 주지 않아
          상세 화면의 숫자는 오가닉만 담고 있습니다.
        </p>
      </CardBody>
    </Card>
  );
}

function SplitRow({ label, hint, split }: { label: string; hint: string; split: PaidSplit }) {
  return (
    <section aria-label={`${label} 광고 구성`} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-neutral-500">
          {label} <span className="text-neutral-400">· {hint}</span>
        </p>
        <p className="text-xs tabular-nums text-neutral-400">합계 {fmtCount(split.total)}</p>
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={`광고 ${fmtPct(split.paidShare)}, 오가닉 ${fmtPct(100 - split.paidShare)}`}
      >
        <div className="bg-brand-500" style={{ width: `${split.paidShare}%` }} />
        <div className="bg-neutral-300" style={{ width: `${100 - split.paidShare}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Stat label="광고" value={split.paid} share={split.paidShare} accent />
        <Stat label="오가닉" value={split.organic} share={100 - split.paidShare} />
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
  value: number;
  share: number;
  accent?: boolean;
}) {
  return (
    <div className="min-w-28 flex-1 rounded-lg bg-surface-muted p-2.5">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900">
        {value.toLocaleString()}
      </p>
      <p className={`text-xs ${accent ? "text-brand-600" : "text-neutral-400"}`}>{fmtPct(share)}</p>
    </div>
  );
}
