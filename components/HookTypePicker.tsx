"use client";
import { useState } from "react";
import { HOOK_TYPE_CATALOG, type HookTypeSpec } from "@/lib/analysis/hookCatalog";
import { hookTypeToMarkdown } from "@/lib/analysis/catalogMarkdown";
import { findHookTypeSpec, toggleHookType } from "@/lib/ui/hookTypeSelection";
import type { HookExample } from "@/lib/ui/hookExamples";
import type { HookType } from "@/lib/schemas/reelAnalysis";
import { cn } from "@/components/ui";
import {
  CatalogBullets,
  CatalogCard,
  CatalogField,
  CatalogParagraph,
} from "@/components/CatalogSection";

interface HookTypePickerProps {
  /** 이미 분석된 릴스에서 뽑은 훅. 고른 유형에 해당하는 것만 카드에 붙는다. */
  examples?: Partial<Record<HookType, HookExample[]>>;
}

function MyReelExamples({ examples }: { examples: HookExample[] }) {
  return (
    <CatalogField label="내 릴스에서 나온 사례">
      <ul className="space-y-2">
        {examples.map((example) => (
          <li key={example.reelId} className="rounded-lg bg-surface-muted px-2.5 py-2">
            <p className="text-sm leading-relaxed text-neutral-800">{example.line}</p>
            <p className="mt-1 text-xs text-neutral-500">{example.why}</p>
            <p className="mt-1 text-xs text-neutral-400">{example.reelTitle}</p>
          </li>
        ))}
      </ul>
    </CatalogField>
  );
}

export function HookTypeCard({
  spec,
  examples,
}: {
  spec: HookTypeSpec;
  examples: HookExample[];
}) {
  return (
    <CatalogCard title={spec.label} copyMarkdown={hookTypeToMarkdown(spec)}>
      <CatalogField label="원리">
        <CatalogParagraph>{spec.principle}</CatalogParagraph>
      </CatalogField>
      <CatalogField label="언제 쓰는가">
        <CatalogParagraph>{spec.whenToUse}</CatalogParagraph>
      </CatalogField>
      <CatalogField label="템플릿 문장">
        <CatalogBullets items={spec.templates} template />
      </CatalogField>
      <CatalogField label="예시">
        <CatalogBullets items={spec.examples} />
      </CatalogField>
      {examples.length > 0 && <MyReelExamples examples={examples} />}
    </CatalogCard>
  );
}

/**
 * 훅 유형 7종을 칩으로 걸어 두고, 고른 하나의 설명만 아래에 편다.
 *
 * 7종을 한꺼번에 늘어놓으면 원리·템플릿·예시가 유형마다 붙어 섹션 하나가 화면을
 * 몇 번이나 넘긴다. 대본이 막혔을 때 찾는 참고서라 한 번에 한 유형만 보면 된다.
 */
export function HookTypePicker({ examples = {} }: HookTypePickerProps) {
  const [selected, setSelected] = useState<HookType | null>(null);
  const spec = findHookTypeSpec(selected);

  return (
    <div className="space-y-3">
      <div role="group" aria-label="훅 유형 고르기" className="flex flex-wrap gap-1">
        {HOOK_TYPE_CATALOG.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => setSelected((prev) => toggleHookType(prev, type.id))}
            aria-pressed={selected === type.id}
            className={cn(
              "min-h-11 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              selected === type.id
                ? "bg-brand-600 text-white"
                : "bg-surface-muted text-neutral-600 hover:text-neutral-900",
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      {spec ? (
        <HookTypeCard spec={spec} examples={examples[spec.id] ?? []} />
      ) : (
        <p className="text-xs text-neutral-500">
          유형을 하나 고르면 원리와 템플릿 문장을 펼쳐 봅니다.
        </p>
      )}
    </div>
  );
}
