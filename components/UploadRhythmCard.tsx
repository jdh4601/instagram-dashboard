"use client";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DAY_LABELS,
  buildUploadRhythm,
  shiftMonth,
  type RhythmDay,
} from "@/lib/analysis/uploadRhythm";
import type { Reel } from "@/lib/schemas";
import { fmtCount } from "@/lib/ui/format";
import { Card, CardBody, CardHeader, cn } from "@/components/ui";

interface Props {
  reels: Reel[];
  /** 테스트에서 기준 시각을 고정하기 위한 주입점. 화면에서는 현재 시각을 쓴다. */
  now?: Date;
}

// 클래스 이름은 Tailwind가 소스에서 그대로 찾아야 하므로 조합해 만들지 않는다.
const LEVEL_CLASS = [
  "bg-rhythm-0",
  "bg-rhythm-1",
  "bg-rhythm-2",
  "bg-rhythm-3",
  "bg-rhythm-4",
] as const;

function cellTitle(day: RhythmDay): string {
  const date = `${Number(day.date.slice(5, 7))}월 ${day.day}일`;
  if (day.dominant === null) return `${date} · 업로드 없음`;
  const parts = [
    day.reels > 0 ? `릴스 ${day.reels}` : null,
    day.carousels > 0 ? `캐러셀 ${day.carousels}` : null,
    `조회 ${fmtCount(day.views)}`,
  ].filter(Boolean);
  return `${date} · ${parts.join(" · ")}`;
}

function DayCell({ day }: { day: RhythmDay | null }) {
  if (day === null) return <div className="h-4 w-4" />;
  // 아직 오지 않은 날은 빈 칸(쉰 날)과 구분해 테두리만 남긴다.
  if (day.future) {
    return <div className="h-4 w-4 rounded-[2px] border border-dashed border-border-subtle" />;
  }
  return (
    <div title={cellTitle(day)} className={cn("h-4 w-4 rounded-[2px]", LEVEL_CLASS[day.level])} />
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-1.5 last:border-b-0">
      <span className="whitespace-nowrap text-xs text-neutral-500">{label}</span>
      <span className="tabular-nums text-sm font-semibold text-neutral-900">{value}</span>
    </div>
  );
}

export function UploadRhythmCard({ reels, now }: Props) {
  const [target, setTarget] = useState<{ year: number; month: number } | undefined>(undefined);
  const resolvedNow = useMemo(() => now ?? new Date(), [now]);
  const rhythm = useMemo(
    () => buildUploadRhythm(reels, target, resolvedNow),
    [reels, target, resolvedNow],
  );

  const { totals } = rhythm;
  const move = (step: number) =>
    setTarget(shiftMonth({ year: rhythm.year, month: rhythm.month }, step));

  return (
    <Card className="w-full lg:w-auto">
      <CardHeader
        title="업로드 리듬"
        icon={<CalendarDays size={16} className="text-brand-500" />}
        action={
          <div className="flex items-center gap-1">
            <span className="tabular-nums text-xs text-neutral-500">{rhythm.label}</span>
            <button
              type="button"
              aria-label="이전 달"
              disabled={!rhythm.hasPrev}
              onClick={() => move(-1)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              aria-label="다음 달"
              disabled={!rhythm.hasNext}
              onClick={() => move(1)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        }
      />
      <CardBody className="flex flex-col gap-4 px-4 pb-4 pt-3 sm:flex-row sm:items-stretch sm:gap-6">
        {/* 칸이 커지면 잔디가 아니라 달력으로 보인다. 칸 크기를 고정해 잔디로 남긴다. */}
        <div className="w-fit shrink-0" role="img" aria-label={`${rhythm.label} 업로드 리듬 달력`}>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] leading-4 text-neutral-400">
            {DAY_LABELS.map((label) => (
              <span key={label} className="w-4">
                {label}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {rhythm.weeks.map((week, weekIndex) =>
              week.map((day, weekday) => <DayCell key={`${weekIndex}-${weekday}`} day={day} />),
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 border-border-subtle sm:w-44 sm:flex-none sm:border-l sm:pl-5">
          <div className="flex flex-col gap-2">
            <Summary label="릴스" value={`${totals.reels}개`} />
            <Summary label="캐러셀" value={`${totals.carousels}개`} />
            <Summary label="업로드일" value={`${totals.uploadDays}일`} />
            <Summary label="최장 공백" value={`${totals.longestGapDays}일`} />
          </div>
          {totals.uploadDays === 0 ? (
            <p className="text-[11px] text-neutral-400">이 달은 업로드 없음</p>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
              <span>적음</span>
              {LEVEL_CLASS.map((className) => (
                <span key={className} className={cn("h-2.5 w-2.5 rounded-[2px]", className)} />
              ))}
              <span>많음</span>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
