import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { STORY_FORMATS, type StoryFormatSpec } from "@/lib/analysis/storyFormats";

/** 목록 카드 한 장. 고를 때 필요한 건 이름과 한 줄 설명뿐이다. */
function FormatCard({ format }: { format: StoryFormatSpec }) {
  return (
    <Link
      href={`/story-formats/${format.id}`}
      className="group flex h-full items-start justify-between gap-3 rounded-card border border-border-subtle bg-surface p-4 transition-colors hover:border-brand-400 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-brand-600">
          {format.label}
        </h3>
        <p className="text-xs leading-relaxed text-neutral-600">{format.description}</p>
      </div>
      <ChevronRight
        size={16}
        aria-hidden
        className="mt-0.5 shrink-0 text-neutral-300 group-hover:text-brand-600"
      />
    </Link>
  );
}

/**
 * 스토리텔링 포맷 10종의 목록.
 *
 * 비트까지 한 화면에 펴 놓으면 무엇을 고를지 판단할 수 없어 이름과 설명만 남기고,
 * 나머지는 `/story-formats/:id` 상세로 미룬다. 두 칸으로 쌓아 열 종을 한눈에 훑는다.
 */
export function StoryFormatGrid() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {STORY_FORMATS.map((format) => (
        <li key={format.id}>
          <FormatCard format={format} />
        </li>
      ))}
    </ul>
  );
}
