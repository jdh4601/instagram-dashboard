"use client";
import { HOOK_TYPE_CATALOG, type HookTypeSpec } from "@/lib/analysis/hookCatalog";
import { SCRIPT_PRINCIPLES, type ScriptPrincipleSpec } from "@/lib/analysis/scriptPrinciples";
import { STORY_FORMATS } from "@/lib/analysis/storyFormats";
import { hookTypeToMarkdown, scriptPrincipleToMarkdown } from "@/lib/analysis/catalogMarkdown";
import type { HookExample } from "@/lib/ui/hookExamples";
import type { HookType } from "@/lib/schemas/reelAnalysis";
import { CatalogCopyButton } from "@/components/CatalogCopyButton";
import { CatalogSection, CatalogField, CatalogBullets } from "@/components/CatalogSection";
import { StoryFormatCatalog } from "@/components/StoryFormatCatalog";

interface HookCatalogProps {
  /** 이미 분석된 릴스에서 뽑은 훅. 없으면 카탈로그만 보여 준다. */
  examples?: Partial<Record<HookType, HookExample[]>>;
}

function CardShell({
  title,
  copyMarkdown,
  children,
}: {
  title: string;
  copyMarkdown: string;
  children: React.ReactNode;
}) {
  return (
    <article className="space-y-3 rounded-card border border-border-subtle bg-surface p-4">
      <header className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 text-sm font-semibold text-neutral-900">{title}</h4>
        <CatalogCopyButton markdown={copyMarkdown} label={title} />
      </header>
      {children}
    </article>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-neutral-700">{children}</p>;
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

function HookTypeCard({ spec, examples }: { spec: HookTypeSpec; examples: HookExample[] }) {
  return (
    <CardShell title={spec.label} copyMarkdown={hookTypeToMarkdown(spec)}>
      <CatalogField label="원리">
        <Paragraph>{spec.principle}</Paragraph>
      </CatalogField>
      <CatalogField label="언제 쓰는가">
        <Paragraph>{spec.whenToUse}</Paragraph>
      </CatalogField>
      <CatalogField label="템플릿 문장">
        <CatalogBullets items={spec.templates} template />
      </CatalogField>
      <CatalogField label="예시">
        <CatalogBullets items={spec.examples} />
      </CatalogField>
      {examples.length > 0 && <MyReelExamples examples={examples} />}
    </CardShell>
  );
}

function PrincipleCard({ spec }: { spec: ScriptPrincipleSpec }) {
  return (
    <CardShell title={spec.label} copyMarkdown={scriptPrincipleToMarkdown(spec)}>
      <p className="text-xs leading-relaxed text-neutral-600">{spec.summary}</p>
      <CatalogField label="정의">
        <Paragraph>{spec.definition}</Paragraph>
      </CatalogField>
      <CatalogField label="왜 작동하는가">
        <Paragraph>{spec.whyItWorks}</Paragraph>
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
    </CardShell>
  );
}

/**
 * 훅 보관함 아래에 붙는 카탈로그.
 *
 * 보관함은 "내가 담아 둔 문장"이고 여기는 "어떤 유형이 있는지"다. 둘을 한 화면에
 * 두되 접어 놓는 이유: 카탈로그는 매번 읽는 게 아니라 대본이 막혔을 때 펴 보는
 * 참고서라, 기본으로 펼쳐 두면 보관함이 화면 밖으로 밀려난다.
 */
export function HookCatalog({ examples = {} }: HookCatalogProps) {
  return (
    <section aria-label="훅 카탈로그" className="space-y-3">
      <CatalogSection
        title="훅 유형 카탈로그"
        count={HOOK_TYPE_CATALOG.length}
        description="첫 3초를 어디서 비트는가에 따라 나뉜 7가지 유형입니다."
      >
        {HOOK_TYPE_CATALOG.map((spec) => (
          <HookTypeCard key={spec.id} spec={spec} examples={examples[spec.id] ?? []} />
        ))}
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

      <CatalogSection
        title="스토리텔링 포맷"
        count={STORY_FORMATS.length}
        description="포맷마다 고유한 비트 시퀀스가 있습니다. 빠진 비트가 곧 약해지는 지점입니다."
      >
        <StoryFormatCatalog />
      </CatalogSection>
    </section>
  );
}
