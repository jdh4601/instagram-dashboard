"use client";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Film } from "lucide-react";
import {
  DAY_LABELS,
  buildUploadRhythm,
  shiftMonth,
  type RhythmDay,
  type RhythmPost,
} from "@/lib/analysis/uploadRhythm";
import type { AudienceMix } from "@/lib/analysis/audienceMix";
import type { Reel } from "@/lib/schemas";
import { fmtCount } from "@/lib/ui/format";
import { Card, CardBody, CardHeader, cn } from "@/components/ui";
import { ReachMixSection } from "@/components/ReachMixSection";

interface Props {
  reels: Reel[];
  /** 도달 구성. 스냅샷이 없으면 달력만 남는다. */
  mix?: AudienceMix | null;
  /** 테스트에서 기준 시각을 고정하기 위한 주입점. 화면에서는 현재 시각을 쓴다. */
  now?: Date;
}

const KIND_LABEL = { REELS: "릴스", CAROUSEL: "캐러셀" } as const;
// 클래스 이름은 Tailwind가 소스에서 그대로 찾아야 하므로 조합해 만들지 않는다.
const KIND_DOT = { REELS: "bg-post-reel", CAROUSEL: "bg-post-carousel" } as const;

function monthDay(date: string, day: number): string {
  return `${Number(date.slice(5, 7))}월 ${day}일`;
}

/** 그날 무엇을 올렸는지 한 줄로. 릴스만·캐러셀만·둘 다를 여기서 구분한다. */
export function dayTitle(day: RhythmDay): string {
  const date = monthDay(day.date, day.day);
  if (day.posts.length === 0) return `${date} · 업로드 없음`;
  const parts = [
    day.reels > 0 ? `릴스 ${day.reels}` : null,
    day.carousels > 0 ? `캐러셀 ${day.carousels}` : null,
  ].filter(Boolean);
  return `${date} · ${parts.join(" · ")}`;
}

function PostRow({ post }: { post: RhythmPost }) {
  return (
    <li className="flex items-center gap-2">
      {post.thumbnailUrl ? (
        // 인스타 CDN 주소라 next/image의 도메인 허용 목록을 사람이 손으로 관리하게 된다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumbnailUrl}
          alt=""
          className="aspect-[9/16] w-7 shrink-0 rounded-sm object-cover"
        />
      ) : (
        // 썸네일이 없어도 같은 자리를 차지해야 줄이 들쭉날쭉하지 않다.
        <div className="flex aspect-[9/16] w-7 shrink-0 items-center justify-center rounded-sm bg-surface-muted text-neutral-300">
          <Film size={11} aria-hidden />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-neutral-900">{post.title}</p>
        <p className="text-[10px] text-neutral-500">
          <span className={cn("mr-1 inline-block size-1.5 rounded-full align-middle", KIND_DOT[post.kind])} />
          {KIND_LABEL[post.kind]} · 조회 {fmtCount(post.views)}
        </p>
      </div>
    </li>
  );
}

/**
 * 칸을 가리켰을 때 뜨는 말풍선.
 *
 * 개수만 말하면 "그래서 뭘 올렸더라"를 다시 목록에서 찾아야 한다. 썸네일과 제목을
 * 함께 띄워 달력에서 바로 알아보게 한다.
 */
export function DayPostsPopover({ day }: { day: RhythmDay }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-56 -translate-x-1/2 rounded-lg border border-border-subtle bg-surface p-2 shadow-card"
    >
      <p className="mb-1.5 text-[11px] font-semibold text-neutral-700">{dayTitle(day)}</p>
      <ul className="space-y-1.5">
        {day.posts.map((post) => (
          <PostRow key={post.id} post={post} />
        ))}
      </ul>
    </div>
  );
}

function DayCell({
  day,
  active,
  onActivate,
  onLeave,
}: {
  day: RhythmDay | null;
  active: boolean;
  onActivate: (date: string) => void;
  onLeave: () => void;
}) {
  // 그 달이 아닌 칸. 자리는 지키되 아무것도 그리지 않는다.
  if (day === null) return <div className="aspect-square" />;

  const empty = day.posts.length === 0;
  const number = (
    <span
      className={cn(
        "text-[11px] tabular-nums",
        day.future ? "text-neutral-300" : empty ? "text-neutral-400" : "font-semibold text-neutral-900",
      )}
    >
      {day.day}
    </span>
  );

  if (empty) {
    return (
      <div
        className={cn(
          "flex aspect-square flex-col items-center justify-start rounded-md border p-1",
          day.future ? "border-dashed border-border-subtle" : "border-transparent bg-surface-muted",
        )}
      >
        {number}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={dayTitle(day)}
        onMouseEnter={() => onActivate(day.date)}
        onMouseLeave={onLeave}
        onFocus={() => onActivate(day.date)}
        onBlur={onLeave}
        className={cn(
          "flex aspect-square w-full flex-col items-center justify-start gap-1 rounded-md border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
          active ? "border-brand-400 bg-surface-muted" : "border-border-subtle bg-surface",
        )}
      >
        {number}
        {/* 올린 개수만큼 점을 찍는다. 여러 줄로 흘러도 칸을 넘지 않게 감싼다. */}
        <span className="flex flex-wrap items-center justify-center gap-0.5">
          {day.posts.map((post) => (
            <span
              key={post.id}
              className={cn("size-1.5 rounded-full", KIND_DOT[post.kind])}
              aria-hidden
            />
          ))}
        </span>
      </button>
      {/* 떠 있는 말풍선은 언제나 하나뿐이다 — CSS hover로 두면 눌러서 포커스가 남은
          칸의 말풍선이 지워지지 않고 겹친다. */}
      {active && <DayPostsPopover day={day} />}
    </div>
  );
}

export function UploadRhythmCard({ reels, mix = null, now }: Props) {
  const [target, setTarget] = useState<{ year: number; month: number } | undefined>(undefined);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const resolvedNow = useMemo(() => now ?? new Date(), [now]);
  const rhythm = useMemo(
    () => buildUploadRhythm(reels, target, resolvedNow),
    [reels, target, resolvedNow],
  );

  const { totals } = rhythm;
  const move = (step: number) => {
    setActiveDate(null);
    setTarget(shiftMonth({ year: rhythm.year, month: rhythm.month }, step));
  };

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
      <CardBody className="space-y-4">
        {mix !== null && <ReachMixSection mix={mix} />}

        {/* 달력이 카드 폭을 그대로 쓴다 — 칸이 커야 날짜를 짚고 눌러 볼 수 있다. */}
        <div aria-label={`${rhythm.label} 업로드 리듬 달력`}>
          <div className="grid w-full grid-cols-7 gap-1 text-center text-[11px] leading-5 text-neutral-400">
            {DAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-1 grid w-full grid-cols-7 gap-1">
            {rhythm.weeks.map((week, weekIndex) =>
              week.map((day, weekday) => (
                <DayCell
                  key={`${weekIndex}-${weekday}`}
                  day={day}
                  active={day !== null && day.date === activeDate}
                  onActivate={setActiveDate}
                  onLeave={() => setActiveDate(null)}
                />
              )),
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-post-reel" aria-hidden />
            릴스 {totals.reels}개
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-post-carousel" aria-hidden />
            캐러셀 {totals.carousels}개
          </span>
          <span>업로드일 {totals.uploadDays}일</span>
        </div>
      </CardBody>
    </Card>
  );
}
