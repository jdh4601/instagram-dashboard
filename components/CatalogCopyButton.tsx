"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/components/ui";

interface CatalogCopyButtonProps {
  /** 클립보드에 넣을 마크다운 한 덩어리 */
  markdown: string;
  /** 무엇을 복사하는지 보조기술에 알릴 이름 */
  label: string;
  className?: string;
}

/**
 * 카탈로그 한 항목을 통째로 복사하는 버튼.
 *
 * `components/ui/CopyButton`은 아이콘만 있는 인라인 버튼이라 자막 한 줄 옆에
 * 붙이기엔 맞지만, 카드 헤더에서는 무엇이 복사됐는지 눈으로 확인돼야 한다.
 * 그래서 글자를 달고 성공 시 "복사됨"으로 뒤집는다.
 */
export function CatalogCopyButton({ markdown, label, className }: CatalogCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드를 못 쓰는 환경(비보안 컨텍스트 등)에서는 버튼 상태를 바꾸지 않는다.
      // 성공하지 않았는데 "복사됨"이 뜨면 붙여넣기에서야 실패를 알게 된다.
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`${label} 전체를 마크다운으로 복사`}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-8",
        copied
          ? "bg-brand-50 text-brand-700"
          : "text-neutral-400 hover:bg-surface-muted hover:text-neutral-700",
        className,
      )}
    >
      {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      {copied ? "복사됨" : "전체 복사"}
    </button>
  );
}
