import { Megaphone } from "lucide-react";
import type { AdEfficiencyRow } from "@/lib/analysis/adEfficiency";
import { AD_RESULT_LABELS, type AdResultType } from "@/lib/schemas";
import { fmtWon } from "@/lib/ui/format";
import { Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  /** 이 게시물의 광고 성과. 태우지 않았으면 null이라 카드가 사라진다. */
  ad: AdEfficiencyRow | null;
}

/** 결과 유형을 사람 말로. 모르는 유형(Marketing API의 새 행동)은 원문 그대로 둔다. */
function resultLabel(type: string): string {
  return AD_RESULT_LABELS[type as AdResultType] ?? type;
}

/**
 * 게시물 한 건이 광고로 얻은 도달.
 *
 * 광고 도달과 게시물 레벨 reach는 겹치지 않는다 — 후자는 오가닉만 세고 광고 도달은
 * 광고 계정이 따로 센다. 그래서 둘을 더한 값이 이 게시물이 닿은 전체이고, 비중의
 * 분모도 그 합이어야 한다. 게시물 reach를 분모로 쓰면 광고 몫이 부풀어 보인다.
 *
 * 광고를 태우지 않았으면 그리지 않는다. 0원짜리 카드는 "태웠는데 성과가 0"으로 읽힌다.
 */
export function MediaAdReachCard({ ad }: Props) {
  if (ad === null) return null;

  const totalReach = ad.organicReach + ad.adReach;
  const paidShare = totalReach > 0 ? (ad.adReach / totalReach) * 100 : null;

  return (
    <Card>
      <CardHeader
        title="광고로 얻은 도달"
        icon={<Megaphone size={16} className="text-brand-500" />}
        action={
          <span className="text-xs text-neutral-500">
            부스트 {ad.adCount}회
          </span>
        }
      />
      <CardBody>
        <div className="flex flex-wrap items-stretch gap-2">
          <Cell
            label="광고 도달"
            value={ad.adReach.toLocaleString()}
            note={paidShare === null ? "비중을 잴 수 없음" : `전체 도달의 ${paidShare.toFixed(1)}%`}
            accent
          />
          <Cell
            label="오가닉 도달"
            value={ad.organicReach.toLocaleString()}
            note="광고 없이 닿은 사람"
          />
          <Cell label="지출" value={fmtWon(ad.spend)} note={`총 ${ad.adCount}회 집행`} />
          <Cell
            label="도달 단가"
            value={ad.costPerReach === null ? "—" : fmtWon(ad.costPerReach)}
            note="한 명에게 닿는 데 든 돈"
          />
          {ad.resultType !== null && ad.resultCount !== null && (
            <Cell
              label={resultLabel(ad.resultType)}
              value={ad.resultCount.toLocaleString()}
              note={
                ad.costPerResult === null
                  ? "단가를 잴 수 없음"
                  : `건당 ${fmtWon(ad.costPerResult)}`
              }
            />
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          광고 도달은 위 오가닉 지표에 들어 있지 않습니다 — 게시물 지표는 오가닉만 세고,
          광고 도달은 광고 계정이 따로 셉니다. 그래서 두 수를 더한 {totalReach.toLocaleString()}
          명이 이 게시물이 닿은 전체입니다.
          {/* Ad Center는 광고에 달린 좋아요·저장을 알려주지 않아 참여 단가를 지어내지 않는다. */}
        </p>
      </CardBody>
    </Card>
  );
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
