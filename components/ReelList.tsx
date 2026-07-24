"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Film, Eye, Calendar, Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import type { Reel } from "@/lib/schemas";
import { reelTitle } from "@/lib/ui/reelTitle";
import { selectReels, SORT_LABELS, type ReelSort } from "@/lib/ui/reelSelect";
import { fmtCount, fmtPct } from "@/lib/ui/format";
import { cn } from "@/components/ui";
import { MediaTypeToggle } from "@/components/MediaTypeToggle";
import { MEDIA_FILTER_LABELS, type MediaFilter } from "@/lib/ui/mediaFilter";

interface Props {
  reels: Reel[];
  filter: MediaFilter;
  onFilterChange: (value: MediaFilter) => void;
}

export function ReelList({ reels, filter, onFilterChange }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ReelSort>("latest");

  const visible = useMemo(() => selectReels(reels, query, sort), [reels, query, sort]);

  if (reels.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">게시물 목록</h2>
          <MediaTypeToggle value={filter} onChange={onFilterChange} />
        </div>
        <div className="rounded-card border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-neutral-500">
          <Film className="mx-auto mb-2 text-neutral-300" size={28} />
          {/* 목록은 이미 걸러진 채로 들어온다. 전체 필터에서 비었을 때만 저장소가
              비었다고 단정할 수 있고, 나머지는 필터 때문일 수도 있어 문구를 나눈다. */}
          {filter === "ALL"
            ? "아직 게시물이 없습니다. 상단의 동기화로 Instagram에서 가져오세요."
            : `${MEDIA_FILTER_LABELS[filter]} 게시물이 없습니다. 다른 종류를 보거나 동기화해 주세요.`}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">게시물 목록</h2>
        <div className="flex items-center gap-2">
          <MediaTypeToggle value={filter} onChange={onFilterChange} />
          <span className="text-xs text-neutral-500">{visible.length}개</span>
        </div>
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
            <ReelRow key={r.id} reel={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReelRow({ reel }: { reel: Reel }) {
  return (
    <Link
      href={`/reel/${reel.id}`}
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
