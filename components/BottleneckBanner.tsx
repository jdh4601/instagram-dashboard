import { Zap, CheckCircle2, HelpCircle, TrendingUp, TrendingDown } from "lucide-react";
import type { MetricVerdict } from "@/lib/analysis/diagnosis";
import { MIN_REACH_FOR_VERDICT } from "@/config/benchmarks";
import { fmtPct } from "@/lib/ui/format";

interface Props {
  bottleneck: MetricVerdict | null;
  delta: number | null;
  /** 도달이 판정 최소 표본에 못 미치면 초록/빨강 대신 중립 안내를 낸다. */
  insufficientSample?: boolean;
  reach?: number;
}

export function BottleneckBanner({
  bottleneck,
  delta,
  insufficientSample = false,
  reach,
}: Props) {
  // 표본 부족을 "병목 없음"(초록)으로 읽히게 두면 안 된다. 도달이 평균의 1/4인
  // 게시물에 "잘 하고 있어요"가 뜨던 원인이다.
  if (insufficientSample) {
    return (
      <div className="flex items-start gap-3 rounded-card border border-neutral-200 bg-neutral-50 p-4">
        <HelpCircle className="mt-0.5 shrink-0 text-neutral-400" size={22} />
        <div>
          <p className="font-medium text-neutral-600">
            표본 부족 — 아직 판정할 수 없습니다
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            도달 {reach?.toLocaleString() ?? "-"}건으로는 비율이 흔들립니다.
            판정 기준은 도달 {MIN_REACH_FOR_VERDICT.toLocaleString()}건입니다.
          </p>
        </div>
      </div>
    );
  }

  if (!bottleneck) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-band-strong-border bg-band-strong-soft p-4">
        <CheckCircle2 className="shrink-0 text-band-strong" size={22} />
        <p className="font-medium text-band-strong">뚜렷한 병목이 없습니다 — 잘 하고 있어요.</p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-card border border-band-weak-border bg-band-weak-soft p-4">
      <Zap className="mt-0.5 shrink-0 text-band-weak" size={22} />
      <div>
        <p className="font-semibold text-band-weak">
          이번 병목: {bottleneck.label} {fmtPct(bottleneck.value)} — 도달이 여기서 막힙니다
        </p>
        {delta !== null && delta !== 0 && (
          <p className="mt-1 flex items-center gap-1 text-sm text-neutral-600">
            지난 3개 평균 대비
            <span
              className={
                delta > 0
                  ? "inline-flex items-center gap-0.5 text-band-strong"
                  : "inline-flex items-center gap-0.5 text-band-weak"
              }
            >
              {delta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(delta).toFixed(1)}%p
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
