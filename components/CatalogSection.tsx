"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, cn } from "@/components/ui";

interface CatalogSectionProps {
  title: string;
  /** 이 묶음에 든 항목 수 */
  count: number;
  description?: string;
  children: ReactNode;
}

/**
 * 접었다 펼치는 카탈로그 묶음.
 *
 * 접혀 있을 때도 내용을 DOM에서 지우지 않고 `hidden`으로만 감춘다 — 브라우저
 * 검색(Ctrl+F)으로 원리 문장을 찾다가 섹션을 열게 되는 흐름이 자연스럽고,
 * 열 때마다 25개 카드를 다시 만들 이유도 없다.
 */
export function CatalogSection({ title, count, description, children }: CatalogSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-card px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <span className="min-w-0">
          <span className="text-sm font-semibold text-neutral-800">{title}</span>
          <span className="ml-2 text-xs font-medium text-neutral-400">{count}종</span>
          {description && (
            <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn("shrink-0 text-neutral-400 transition-transform", open && "rotate-180")}
        />
      </button>

      <div hidden={!open} className="space-y-3 border-t border-border-subtle p-4">
        {children}
      </div>
    </Card>
  );
}

interface CatalogFieldProps {
  label: string;
  children: ReactNode;
}

export function CatalogField({ label, children }: CatalogFieldProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      {children}
    </div>
  );
}

interface CatalogBulletsProps {
  items: readonly string[];
  /** 빈칸을 판 템플릿 문장 — 배경을 깔아 본문과 구분한다 */
  template?: boolean;
}

export function CatalogBullets({ items, template }: CatalogBulletsProps) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            "text-sm leading-relaxed text-neutral-700",
            template && "rounded-lg bg-surface-muted px-2.5 py-1.5",
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
