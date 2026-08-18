"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
import type { FormatConfidence, SavedStoryFormat } from "@/lib/schemas";
import { getStoryFormat } from "@/lib/analysis/storyFormats";
import { fmtCount } from "@/lib/ui/format";
import { EmptyState, cn } from "@/components/ui";

const CONFIDENCE_LABELS: Record<FormatConfidence, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const CONFIDENCE_CLASSES: Record<FormatConfidence, string> = {
  high: "bg-band-strong-soft text-band-strong",
  medium: "bg-band-ok-soft text-band-ok",
  low: "bg-band-weak-soft text-band-weak",
};

interface Props {
  items: SavedStoryFormat[];
  onDelete: (id: string) => Promise<void>;
}

function SavedRow({ item, onDelete }: { item: SavedStoryFormat; onDelete: Props["onDelete"] }) {
  const [busy, setBusy] = useState(false);
  const format = getStoryFormat(item.story.formatId);
  const present = item.story.beats.filter((beat) => beat.present).length;

  async function remove() {
    setBusy(true);
    try {
      await onDelete(item.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-start gap-3 rounded-card border border-border-subtle bg-surface p-3">
      {item.source.thumbnailUrl ? (
        // 인스타 CDN 썸네일이다. next/image로 감싸면 도메인 허용 목록을 손으로
        // 관리해야 해서 훅 보관함과 같이 그냥 img로 둔다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.source.thumbnailUrl}
          alt=""
          className="aspect-[9/16] w-12 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="aspect-[9/16] w-12 shrink-0 rounded-lg bg-surface-muted" aria-hidden />
      )}

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 유형이 이 줄의 첫 정보다 — 무엇으로 분류돼 담겼는지가 저장소의 존재 이유다. */}
          <Link
            href={`/story-formats/${item.story.formatId}`}
            className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {format?.label ?? item.story.formatId}
          </Link>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium",
              CONFIDENCE_CLASSES[item.story.confidence],
            )}
          >
            확신 {CONFIDENCE_LABELS[item.story.confidence]}
          </span>
          <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-neutral-600">
            비트 {present}/{item.story.beats.length}
          </span>
          {item.source.views != null && (
            <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-neutral-600">
              조회 {fmtCount(item.source.views)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/reel/${item.source.reelId}`}
            className="truncate text-sm font-medium text-neutral-900 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {item.source.title}
          </Link>
          {item.source.permalink && (
            <a
              href={item.source.permalink}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="인스타그램에서 보기"
              className="text-neutral-400 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <ExternalLink size={14} aria-hidden />
            </a>
          )}
        </div>

        <p className="text-xs leading-relaxed text-neutral-600">{item.story.rationale}</p>
      </div>

      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label="저장한 포맷 삭제"
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-muted hover:text-band-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}

/**
 * 저장한 포맷 판정 목록.
 *
 * 카탈로그(STORY_FORMATS)가 "포맷이란 무엇인가"라면 이 목록은 "내 릴스가 그 포맷을
 * 실제로 어떻게 썼는가"다. 그래서 줄마다 유형 배지를 먼저 세우고 원본 릴스로 잇는다.
 * 최근에 담은 것이 위로 온다 — 방금 저장한 게 화면 밖에 있으면 담겼는지 알 수 없다.
 */
export function SavedStoryFormatList({ items, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="아직 저장한 포맷이 없습니다"
        hint="릴스 상세의 Storytelling Format 탭에서 포맷 저장하기를 누르면 여기에 쌓입니다."
      />
    );
  }

  const newestFirst = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <ul className="space-y-2">
      {newestFirst.map((item) => (
        <SavedRow key={item.id} item={item} onDelete={onDelete} />
      ))}
    </ul>
  );
}
