import { BarChart3 } from "lucide-react";
import type { MetricVerdict } from "@/lib/analysis/diagnosis";
import { verdictBarGeometry } from "@/lib/ui/metricBar";
import { fmtPct } from "@/lib/ui/format";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui";

const BAND_LABEL = { weak: "약점", ok: "보통", strong: "강점" } as const;

interface Props {
  verdicts: MetricVerdict[];
  /** 개인화 베이스라인(내 평균) 임계값으로 진단됐는지 */
  baselineActive?: boolean;
}

export function MetricBars({ verdicts, baselineActive = false }: Props) {
  return (
    <Card>
      <CardHeader
        title="지표 벤치마크"
        icon={<BarChart3 size={16} className="text-brand-600" />}
        action={
          <span className="text-xs text-neutral-400">
            {baselineActive ? "내 평균 기준" : "전체 벤치마크 기준"}
          </span>
        }
      />
      <CardBody className="space-y-3.5">
        {verdicts.map((v) => {
          // 마커는 라벨(band)을 만든 그 threshold로 그린다 — 라벨↔시각화 항상 일치
          const g = verdictBarGeometry(v);
          return (
            <div key={v.key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-neutral-700">{v.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums text-neutral-900">{fmtPct(v.value)}</span>
                  <Badge band={v.band}>{BAND_LABEL[v.band]}</Badge>
                </span>
              </div>
              {/* weak | ok | strong 구간 위에 현재값 마커 */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full">
                <div className="flex h-full w-full">
                  <div style={{ width: `${g.weakPct}%` }} className="bg-band-weak-border" />
                  <div style={{ width: `${g.okPct}%` }} className="bg-band-ok-border" />
                  <div style={{ width: `${g.strongPct}%` }} className="bg-band-strong-border" />
                </div>
                <div
                  style={{ left: `${g.markerPct}%` }}
                  className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900 shadow"
                />
              </div>
              {/* 구간 경계값 눈금 */}
              <div className="relative mt-0.5 h-3 text-[10px] tabular-nums text-neutral-400">
                <span className="absolute -translate-x-1/2" style={{ left: `${g.weakPct}%` }}>
                  {fmtPct(v.threshold.weakBelow)}
                </span>
                <span className="absolute -translate-x-1/2" style={{ left: `${g.weakPct + g.okPct}%` }}>
                  {fmtPct(v.threshold.strongAbove)}
                </span>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
