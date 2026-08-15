import { Megaphone } from "lucide-react";
import type { PaidMix } from "@/lib/analysis/paidMix";
import { fmtPct } from "@/lib/ui/format";
import { Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  /** 광고/오가닉 구성. breakdown을 수집하기 전 스냅샷뿐이면 null이라 카드가 사라진다. */
  mix: PaidMix | null;
}

/**
 * 최근 7일 광고 효율 한 줄.
 *
 * 광고와 오가닉의 절대량을 막대로 견주지 않는다 — 오가닉이 큰 건 당연해서 볼 것이 없다.
 * 도달을 분모로 깐 반응률만 나란히 두면 "산 도달이 제 값을 했는가"가 한눈에 잡힌다.
 *
 * 계정 단위다. 게시물별 광고 효율은 Instagram Login 토큰에 없어(total_views·boost_ads_list
 * 모두 차단) Marketing API를 붙여야 나온다.
 */
export function PaidReachCard({ mix }: Props) {
  if (mix === null) return null;

  return (
    <Card>
      <CardHeader
        title="광고 효율 (최근 7일)"
        icon={<Megaphone size={16} className="text-brand-500" />}
        action={
          <span className="text-xs text-neutral-500">
            {mix.hasPaid ? `기준일 ${mix.date}` : "광고 집행 없음"}
          </span>
        }
      />
      <CardBody>
        {mix.efficiency === undefined ? (
          <p className="text-sm text-neutral-500">
            {mix.hasPaid
              ? "상호작용 분리가 아직 들어오지 않아 반응률을 잴 수 없습니다."
              : "최근 7일 동안 집행한 광고가 없습니다."}
          </p>
        ) : (
          <div className="flex flex-wrap items-stretch gap-2">
            <Cell
              label="광고 도달"
              value={mix.reach.paid.toLocaleString()}
              note={`전체 도달의 ${fmtPct(mix.reach.paidShare)}`}
            />
            <Cell
              label="광고 반응률"
              value={fmtPct(mix.efficiency.paidRate)}
              note="산 도달 100명당 상호작용"
              accent
            />
            <Cell
              label="오가닉 반응률"
              value={fmtPct(mix.efficiency.organicRate)}
              note="그냥 온 도달 100명당"
            />
            <Cell
              label="오가닉 대비"
              value={`${mix.efficiency.ratio.toFixed(2)}배`}
              note={verdict(mix.efficiency.ratio)}
              accent={mix.efficiency.ratio >= 1}
            />
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          계정 전체 합계입니다. 어떤 게시물에 얼마를 태웠는지는 Instagram이 이 토큰에 열어
          주지 않아, 게시물 상세의 숫자는 오가닉만 담고 있습니다.
        </p>
      </CardBody>
    </Card>
  );
}

/** 배수를 사람 말로. 광고는 관심 없는 사람에게도 밀어 넣으므로 1을 밑도는 게 보통이다. */
function verdict(ratio: number): string {
  if (ratio >= 1) return "산 도달이 더 반응함";
  return `오가닉보다 ${Math.round((1 - ratio) * 100)}% 덜 반응`;
}

function Cell({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-36 flex-1 rounded-lg bg-surface-muted p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums ${accent ? "text-brand-600" : "text-neutral-900"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-neutral-400">{note}</p>
    </div>
  );
}
