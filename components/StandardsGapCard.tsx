import { AlertTriangle } from "lucide-react";
import type { StandardsGap } from "@/lib/analysis/standardsGaps";
import { fmtPct } from "@/lib/ui/format";
import { Card, CardBody, CardHeader } from "@/components/ui";

interface Props {
  gaps: StandardsGap[];
}

// 계정이 구조적으로 못하는 것 — 개인 베이스라인이 가리던 절대 기준 미달 지표(INS-10).
export function StandardsGapCard({ gaps }: Props) {
  if (gaps.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="업계 기준 미달 지표"
        icon={<AlertTriangle size={16} className="text-band-weak" />}
      />
      <CardBody className="space-y-4">
        <p className="text-xs text-neutral-400">
          최근 게시물 평균을 포맷별 업계 기준과 비교합니다. 게시물 상세의 &ldquo;내 평균 대비&rdquo;
          판정과 달리, 여기서는 계정 전체가 기준에 못 미치는 지표를 드러냅니다.
        </p>
        {gaps.map((gap) => (
          <div key={gap.kind} className="space-y-1.5">
            <p className="text-sm font-semibold text-neutral-700">
              {gap.label}
              <span className="ml-1 text-xs font-normal text-neutral-400">
                최근 {gap.diagnosis.reelCount}개 평균
              </span>
            </p>
            <ul className="space-y-1">
              {gap.diagnosis.weaknesses.map((v) => (
                <li
                  key={v.key}
                  className="flex items-baseline justify-between gap-3 rounded-lg bg-band-weak-soft px-3 py-2 text-sm"
                >
                  <span className="text-neutral-700">{v.label}</span>
                  <span className="tabular-nums text-band-weak">
                    {fmtPct(v.value)}
                    <span className="ml-1 text-xs text-neutral-400">
                      기준 {fmtPct(v.threshold.weakBelow)} 미달
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
