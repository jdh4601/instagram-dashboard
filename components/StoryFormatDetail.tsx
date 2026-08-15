"use client";
import { type StoryBeatSpec, type StoryFormatSpec } from "@/lib/analysis/storyFormats";
import { storyFormatToMarkdown } from "@/lib/analysis/catalogMarkdown";
import { Badge } from "@/components/ui";
import { CatalogCopyButton } from "@/components/CatalogCopyButton";
import { CatalogField, CatalogBullets } from "@/components/CatalogSection";

function Beat({ beat, order }: { beat: StoryBeatSpec; order: number }) {
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-neutral-500">
          {order}
        </span>
        <span className="text-sm font-medium text-neutral-900">{beat.label}</span>
        {/* 라벨에 이미 "(선택)"이 붙은 비트가 있어 배지는 그때 생략한다 */}
        {beat.optional && !beat.label.includes("(선택)") && <Badge>선택</Badge>}
        <span className="text-xs text-neutral-500">{beat.purpose}</span>
      </div>
      <div className="pl-7">
        <CatalogBullets items={beat.templates} template />
      </div>
    </li>
  );
}

/**
 * 포맷 한 종의 전문(全文).
 *
 * 새 데이터를 만들지 않는다 — `STORY_FORMATS`를 그대로 편다. 분석 탭이 비트를
 * 대조할 때 쓰는 바로 그 시퀀스를 사람이 미리 읽어 두는 게 목적이다.
 */
export function StoryFormatDetail({ format }: { format: StoryFormatSpec }) {
  return (
    <article className="space-y-4 rounded-card border border-border-subtle bg-surface p-4 sm:p-5">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-neutral-900">{format.label}</h2>
          <p className="text-sm leading-relaxed text-neutral-600">{format.description}</p>
        </div>
        <CatalogCopyButton markdown={storyFormatToMarkdown(format)} label={format.label} />
      </header>

      <CatalogField label="아웃라이어 조건">
        <CatalogBullets items={format.secretSauce} />
      </CatalogField>

      <CatalogField label="비트 시퀀스">
        <ol className="space-y-3">
          {format.beats.map((beat, index) => (
            <Beat key={beat.id} beat={beat} order={index + 1} />
          ))}
        </ol>
      </CatalogField>
    </article>
  );
}
