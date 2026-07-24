import { ThumbsUp, AlertTriangle } from "lucide-react";
import type { MetricVerdict } from "@/lib/analysis/diagnosis";
import { fmtPct } from "@/lib/ui/format";

interface Props {
  strengths: MetricVerdict[];
  weaknesses: MetricVerdict[];
  /** 게시물 종류에 맞는 표기 — 캐러셀에 "릴스"라고 쓰지 않기 위해 받는다. */
  mediaLabel?: string;
  /** 도달이 부족해 판정을 보류한 상태. "약점 없음"과 구분해야 한다. */
  insufficientSample?: boolean;
}

interface ListProps {
  title: string;
  items: MetricVerdict[];
  icon: React.ReactNode;
  tone: string;
  valueTone: string;
  emptyCopy: string;
}

function List({ title, items, icon, tone, valueTone, emptyCopy }: ListProps) {
  const isEmpty = items.length === 0;
  // 비었을 땐 강한 색(빨강/초록) 박스 대신 중립 톤으로 축소 — 빈 박스가 시선 끌지 않게
  const boxTone = isEmpty ? "border-neutral-200 bg-neutral-50" : tone;
  return (
    <div className={`rounded-card border p-4 ${boxTone}`}>
      <h3 className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${isEmpty ? "text-neutral-400" : ""}`}>
        {icon}
        {title}
      </h3>
      {isEmpty ? (
        <p className="text-sm text-neutral-400">{emptyCopy}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.map((v) => (
            <li key={v.key} className="flex items-center justify-between">
              <span className="text-neutral-700">{v.label}</span>
              <span className={`font-semibold tabular-nums ${valueTone}`}>{fmtPct(v.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DiagnosisCards({
  strengths,
  weaknesses,
  mediaLabel = "게시물",
  insufficientSample = false,
}: Props) {
  const pending = "도달이 쌓이면 판정합니다.";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <List
        title="잘되는 점"
        items={strengths}
        icon={<ThumbsUp size={15} className="text-band-strong" />}
        tone="border-band-strong-border bg-band-strong-soft"
        valueTone="text-band-strong"
        emptyCopy={
          insufficientSample
            ? pending
            : "아직 강점으로 분류된 지표가 없어요. 훅·공유를 먼저 끌어올려 보세요."
        }
      />
      <List
        title="당장 개선"
        items={weaknesses}
        icon={<AlertTriangle size={15} className="text-band-weak" />}
        tone="border-band-weak-border bg-band-weak-soft"
        valueTone="text-band-weak"
        emptyCopy={
          insufficientSample ? pending : `약점이 없습니다 — 균형 잡힌 ${mediaLabel}예요.`
        }
      />
    </div>
  );
}
