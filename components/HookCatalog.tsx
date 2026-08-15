"use client";
import { HOOK_TYPE_CATALOG } from "@/lib/analysis/hookCatalog";
import { SCRIPT_PRINCIPLES, type ScriptPrincipleSpec } from "@/lib/analysis/scriptPrinciples";
import { scriptPrincipleToMarkdown } from "@/lib/analysis/catalogMarkdown";
import type { HookExample } from "@/lib/ui/hookExamples";
import type { HookType } from "@/lib/schemas/reelAnalysis";
import {
  CatalogSection,
  CatalogField,
  CatalogBullets,
  CatalogCard,
  CatalogParagraph,
} from "@/components/CatalogSection";
import { HookTypePicker } from "@/components/HookTypePicker";

interface HookCatalogProps {
  /** 이미 분석된 릴스에서 뽑은 훅. 없으면 카탈로그만 보여 준다. */
  examples?: Partial<Record<HookType, HookExample[]>>;
}

function PrincipleCard({ spec }: { spec: ScriptPrincipleSpec }) {
  return (
    <CatalogCard title={spec.label} copyMarkdown={scriptPrincipleToMarkdown(spec)}>
      <p className="text-xs leading-relaxed text-neutral-600">{spec.summary}</p>
      <CatalogField label="정의">
        <CatalogParagraph>{spec.definition}</CatalogParagraph>
      </CatalogField>
      <CatalogField label="왜 작동하는가">
        <CatalogParagraph>{spec.whyItWorks}</CatalogParagraph>
      </CatalogField>
      <CatalogField label="실행 방법">
        <CatalogBullets items={spec.howTo} />
      </CatalogField>
      <CatalogField label="나쁜 예 vs 좋은 예">
        <div className="space-y-1.5">
          <p className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-sm leading-relaxed text-neutral-500 line-through decoration-neutral-300">
            {spec.badExample}
          </p>
          <p className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm leading-relaxed text-neutral-800">
            {spec.goodExample}
          </p>
        </div>
      </CatalogField>
    </CatalogCard>
  );
}

/**
 * 훅 보관함 아래에 붙는 카탈로그.
 *
 * 보관함은 "내가 담아 둔 문장"이고 여기는 "어떤 유형이 있는지"다. 둘을 한 화면에
 * 두되 접어 놓는 이유: 카탈로그는 매번 읽는 게 아니라 대본이 막혔을 때 펴 보는
 * 참고서라, 기본으로 펼쳐 두면 보관함이 화면 밖으로 밀려난다.
 *
 * 스토리텔링 포맷은 훅이 아니라 대본 전체의 뼈대라 `/story-formats` 탭으로 나갔다.
 */
export function HookCatalog({ examples = {} }: HookCatalogProps) {
  return (
    <section aria-label="훅 카탈로그" className="space-y-3">
      <CatalogSection
        title="훅 유형 카탈로그"
        count={HOOK_TYPE_CATALOG.length}
        description="첫 3초를 어디서 비트는가에 따라 나뉜 7가지 유형입니다."
      >
        <HookTypePicker examples={examples} />
      </CatalogSection>

      <CatalogSection
        title="스크립트 원리"
        count={SCRIPT_PRINCIPLES.length}
        description="릴스 분석이 1~5점으로 매기는 바로 그 8가지 기준입니다."
      >
        {SCRIPT_PRINCIPLES.map((spec) => (
          <PrincipleCard key={spec.id} spec={spec} />
        ))}
      </CatalogSection>
    </section>
  );
}
