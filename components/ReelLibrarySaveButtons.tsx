"use client";
import { useState } from "react";
import Link from "next/link";
import { Bookmark, Check, LoaderCircle } from "lucide-react";
import {
  HOOK_CATEGORY_LABELS,
  type Reel,
  type ReelAnalysis,
  type ReelStoryFormat,
} from "@/lib/schemas";
import { getStoryFormat } from "@/lib/analysis/storyFormats";
import { buildHookDraftFromReel } from "@/lib/ui/hookDraftFromAnalysis";
import { cn } from "@/components/ui";

/** 라우트가 실패 사유를 본문에 담아 준다. 상태 코드만 보여주면 고칠 방법을 알 수 없다. */
async function failureMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const detail = body && typeof body.error === "string" ? body.error : null;
  return detail ?? `${fallback} (${res.status})`;
}

interface SaveButtonProps {
  label: string;
  /** 어느 서랍으로 들어가는지. 누르기 전에 보여야 잘못 담고 나서 고치지 않는다. */
  type: string;
  savedLabel: string;
  /** 담긴 뒤 확인하러 갈 저장소 */
  href: string;
  onSave: () => Promise<void>;
}

/**
 * 분석 탭에서 저장소로 한 항목을 옮기는 버튼.
 *
 * 담긴 뒤에는 버튼을 저장소 링크로 바꾼다 — 같은 자리에 저장 버튼이 그대로 남아
 * 있으면 담겼는지 알 수 없어 한 번 더 누르게 된다.
 */
function SaveToLibraryButton({ label, type, savedLabel, href, onSave }: SaveButtonProps) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setError(null);
    try {
      await onSave();
      setState("saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장하지 못했습니다");
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {state === "saved" ? (
        <Link
          href={href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-band-strong-soft px-3 text-sm font-medium text-band-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Check size={15} aria-hidden />
          {savedLabel}
        </Link>
      ) : (
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
            state === "saving" && "cursor-wait opacity-70",
          )}
        >
          {state === "saving" ? (
            <LoaderCircle size={15} className="animate-spin" aria-hidden />
          ) : (
            <Bookmark size={15} aria-hidden />
          )}
          {label}
          <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-neutral-500">
            {type}
          </span>
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-band-weak">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Hook 탭의 저장 버튼.
 *
 * 화면에 이미 보이는 판정만 옮긴다. 훅 문장이 비어 있으면 담을 게 없으므로 버튼
 * 자체를 내지 않는다 — 눌러 봐야 400만 돌아온다.
 */
export function SaveHookButton({ reel, analysis }: { reel: Reel; analysis: ReelAnalysis }) {
  const draft = buildHookDraftFromReel(reel, analysis);
  if (!draft) return null;

  return (
    <SaveToLibraryButton
      label="훅 저장하기"
      type={HOOK_CATEGORY_LABELS[draft.category]}
      savedLabel="훅 저장소에 담김"
      href="/hooks"
      onSave={async () => {
        const res = await fetch("/api/hooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error(await failureMessage(res, "훅을 저장하지 못했습니다"));
      }}
    />
  );
}

/**
 * Storytelling Format 탭의 저장 버튼.
 *
 * 판정 내용은 보내지 않고 릴스 id만 넘긴다 — 서버가 저장된 분석에서 직접 읽어야
 * 화면과 저장소가 갈라지지 않는다.
 */
export function SaveStoryFormatButton({
  reelId,
  story,
}: {
  reelId: string;
  story: ReelStoryFormat;
}) {
  const format = getStoryFormat(story.formatId);

  return (
    <SaveToLibraryButton
      label="포맷 저장하기"
      type={format?.label ?? story.formatId}
      savedLabel="포맷 저장소에 담김"
      href="/story-formats"
      onSave={async () => {
        const res = await fetch("/api/story-formats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reelId }),
        });
        if (!res.ok) throw new Error(await failureMessage(res, "포맷을 저장하지 못했습니다"));
      }}
    />
  );
}
