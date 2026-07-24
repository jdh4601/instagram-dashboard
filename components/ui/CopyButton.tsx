"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "./cn";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 접근 불가(비보안 컨텍스트 등) — 조용히 무시
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? "복사됨" : "텍스트 복사"}
      title={copied ? "복사됨" : "복사"}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-surface-muted hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:h-7 sm:w-7",
        className,
      )}
    >
      {copied ? (
        <Check size={13} className="text-band-strong" aria-hidden="true" />
      ) : (
        <Copy size={13} aria-hidden="true" />
      )}
    </button>
  );
}
