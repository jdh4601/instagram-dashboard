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

/** 그날 무엇을 올렸는지 한 줄로. 릴스만·캐러셀만·둘 다를 여기서 구분한다. */
export function dayTitle(day: RhythmDay): string {
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
  // 그 달이 아닌 칸. 자리는 지키되 아무것도 그리지 않는다.
  if (day === null) return <div className="aspect-square" />;

  // 아직 오지 않은 날은 빈 칸(쉰 날)과 구분해 테두리만 남긴다.
  if (day.future) {
    return (
      <div className="aspect-square rounded-md border border-dashed border-border-subtle" />
    );
  }

  // 올리지 않은 날은 누를 것이 없다. 잔디 바탕만 깔고 넘어간다.
  if (day.dominant === null) {
    return <div className="aspect-square rounded-md bg-rhythm-0" />;
  }

  const title = dayTitle(day);
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={title}
        className={cn(
          "aspect-square w-full rounded-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
          LEVEL_CLASS[day.level],
        )}
      />
      {/* 손가락으로도 볼 수 있어야 해서 hover만이 아니라 포커스에도 띄운다.
          색은 surface/neutral 토큰으로 잡는다 — 고정 색을 쓰면 다크 모드에서
          글자와 배경이 같이 밝아져 읽히지 않는다. */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-subtle bg-surface px-2 py-1 text-[11px] font-medium text-neutral-900 opacity-0 shadow-card transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {title}
      </span>
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
    <Card>
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
      <CardBody className="space-y-3">
        {/* 달력이 카드 폭을 그대로 쓴다 — 칸이 커야 어느 날인지 짚고 눌러 볼 수 있다. */}
        <div aria-label={`${rhythm.label} 업로드 리듬 달력`}>
          <div className="grid w-full grid-cols-7 gap-1.5 text-center text-[11px] leading-5 text-neutral-400">
            {DAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-1.5 grid w-full grid-cols-7 gap-1.5">
            {rhythm.weeks.map((week, weekIndex) =>
              week.map((day, weekday) => <DayCell key={`${weekIndex}-${weekday}`} day={day} />),
            )}
          </div>
        </div>

        <p className="text-xs text-neutral-500">
          릴스 {totals.reels}개 · 캐러셀 {totals.carousels}개 · 업로드일 {totals.uploadDays}일
        </p>
      </CardBody>
    </Card>
  );
}
