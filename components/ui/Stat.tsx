import type { ReactNode } from "react";
import { cn } from "./cn";
import { Card } from "./Card";

interface StatProps {
  label: string;
  /** "도달 대비"처럼 라벨 앞에 붙는 짧은 수식어. 작은 회색 글씨로 라벨 위 별도 줄에 표시. */
  labelQualifier?: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  className?: string;
}

// 수치 카드: 라벨 + 큰 값 + 보조 힌트(증감 배지 등)
// 라벨 영역 높이를 고정해, qualifier 유무와 상관없이 그리드의 모든 카드가 같은 높이에서
// 값(value)이 시작하도록 한다. 그렇지 않으면 라벨이 긴 카드만 줄바꿈되어 아래로 밀린다.
export function Stat({ label, labelQualifier, value, icon, hint, className }: StatProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between">
        <div className="flex min-h-7 flex-col justify-end">
          {labelQualifier && (
            <span className="text-[10px] leading-tight text-neutral-400">{labelQualifier}</span>
          )}
          <span className="text-xs leading-tight font-medium text-neutral-500">{label}</span>
        </div>
        {icon && <span className="text-neutral-400">{icon}</span>}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </Card>
  );
}
