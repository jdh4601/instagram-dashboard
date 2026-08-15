"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Film, Eye, Calendar, Heart, MessageCircle, Share2, Bookmark, RefreshCw } from "lucide-react";
import type { Reel } from "@/lib/schemas";
import { AGE_TARGET_HOURS, type AgeNormalizedViews } from "@/lib/analysis/ageNormalized";
import { reelTitle } from "@/lib/ui/reelTitle";
import { selectReels, SORT_LABELS, type EarlyViewsMap, type ReelSort } from "@/lib/ui/reelSelect";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { cn } from "@/components/ui";
import { emptyListMessage, type MediaFilter } from "@/lib/ui/mediaFilter";
import { mediaKindOf } from "@/lib/media/kind";
import { detailPathForMedia } from "@/lib/ui/navigation";

interface Props {
  reels: Reel[];
  /** 이미 이 종류로 걸러진 목록이 들어온다. 화면에서 바꿀 수 없고, 빈 목록 문구에만 쓴다. */
  filter: MediaFilter;
  /** 동기화가 진행 중이면 목록이 아직 갱신 전이라는 뜻이다. */
  syncing?: boolean;
  /** 게시 후 48시간 조회수. 경과일이 다른 게시물을 공정하게 견주는 정렬에 쓴다. */
  earlyViews?: EarlyViewsMap;
}

export function ReelList({ reels, filter, syncing = false, earlyViews }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ReelSort>("latest");

  const visible = useMemo(
    () => selectReels(reels, query, sort, earlyViews),
    [reels, query, sort, earlyViews],
  );

  if (reels.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-700">게시물 목록</h2>
        <div
          role={syncing ? "status" : undefined}
          aria-live={syncing ? "polite" : undefined}
          className="rounded-card border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-neutral-500"
        >
          {syncing ? (
            <RefreshCw className="mx-auto mb-2 animate-spin text-neutral-300" size={28} />
          ) : (
            <Film className="mx-auto mb-2 text-neutral-300" size={28} />
          )}
          {emptyListMessage(filter, syncing)}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">게시물 목록</h2>
        <span className="text-xs text-neutral-500">{visible.length}개</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            size={15}
            aria-hidden="true"
          />
          <input
            aria-label="게시물 제목과 캡션 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목·캡션 검색"
            className="h-11 w-full rounded-lg border border-border-subtle bg-surface pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:h-9"
          />
        </div>
        <div
          role="group"
          aria-label="게시물 정렬"
          className="flex gap-1 rounded-lg border border-border-subtle bg-surface p-0.5"
        >
          {(Object.keys(SORT_LABELS) as ReelSort[]).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setSort(s)}
              aria-pressed={sort === s}
              className={cn(
                "min-h-11 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-8",
                sort === s ? "bg-brand-600 text-white" : "text-neutral-600 hover:bg-surface-muted",
              )}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">검색 결과가 없습니다.</p>
      ) : (
        <div className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface">
          {visible.map((r) => (
            // 정렬 기준이 보이지 않으면 순서를 이해할 수 없다. 48h 정렬일 때만 병기.
            <ReelRow
              key={r.id}
              reel={r}
              early={sort === "earlyViews" ? earlyViews?.[r.id] ?? null : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReelRow({
  reel,
  early,
}: {
  reel: Reel;
  /** undefined = 표시 안 함, null = 이력이 없어 값을 낼 수 없음 */
  early?: AgeNormalizedViews | null;
}) {
  return (
    <Link
      href={detailPathForMedia(mediaKindOf(reel), reel.id)}
      className="group flex items-center gap-3 p-3 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
    >
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-neutral-100">
        {reel.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reel.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <Film size={16} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900 group-hover:text-brand-600">
          {reelTitle(reel)}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-0.5">
            <Calendar size={11} />
            {reel.postedAt.slice(0, 10)}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Eye size={11} />
            {fmtCount(reel.views)}
          </span>
          {early !== undefined && (
            <span className="text-brand-600">
              {early === null
                ? "48h 이력 없음"
                : `48h ${fmtCount(early.views)}${
                    Math.round(early.elapsedHours) === AGE_TARGET_HOURS
                      ? ""
                      : ` (실제 ${Math.round(early.elapsedHours)}h)`
                  }`}
            </span>
          )}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-3 text-xs text-neutral-600 sm:flex">
        <Metric icon={<Heart size={12} />} value={reel.likes} />
        <Metric icon={<MessageCircle size={12} />} value={reel.comments} />
        <Metric icon={<Bookmark size={12} />} value={reel.saves} />
        <Metric icon={<Share2 size={12} />} value={reel.shares} />
      </div>

      <div className="shrink-0 text-right">
        <div className="text-xs font-semibold text-neutral-900">
          {fmtPct(reel.derived?.engagementRate ?? 0)}
        </div>
        <div className="text-[10px] text-neutral-500">인게이지먼트</div>
      </div>
    </Link>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums">
      {icon}
      {fmtCount(value)}
    </span>
  );
}
