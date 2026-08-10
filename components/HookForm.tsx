"use client";
import { useState, type FormEvent } from "react";
import {
  HOOK_CATEGORIES,
  HOOK_CATEGORY_LABELS,
  type Hook,
  type HookCategory,
  type HookDraft,
} from "@/lib/schemas";
import { Input, Button } from "@/components/ui";

interface Props {
  /** 값이 있으면 수정, 없으면 새 훅 추가다. */
  editing: Hook | null;
  onSubmit: (draft: HookDraft, id?: string) => Promise<void>;
  onCancel: () => void;
}

// 훅 문장만 필수다. 나머지는 나중에 채울 수 있게 열어 둬야 보관 자체를 미루지 않는다.
export function HookForm({ editing, onSubmit, onCancel }: Props) {
  const [text, setText] = useState(editing?.text ?? "");
  const [category, setCategory] = useState<HookCategory>(editing?.category ?? "problem");
  const [sourceHandle, setSourceHandle] = useState(editing?.sourceHandle ?? "");
  const [sourceUrl, setSourceUrl] = useState(editing?.sourceUrl ?? "");
  const [views, setViews] = useState(editing?.views != null ? String(editing.views) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("훅 문장을 입력해 주세요");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(
        {
          text: text.trim(),
          category,
          // 빈 문자열을 그대로 보내면 스키마의 URL·핸들 검증에 걸린다. 미입력은 없는 값이다.
          sourceHandle: sourceHandle.trim() ? sourceHandle.trim().replace(/^@/, "") : undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          views: views.trim() ? Number(views) : undefined,
          note: note.trim() || undefined,
          isFavorite: editing?.isFavorite,
        },
        editing?.id,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다");
      return;
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-card border border-border-subtle bg-surface p-4"
      aria-label={editing ? "훅 수정" : "훅 추가"}
    >
      <div className="space-y-1">
        <label htmlFor="hook-text" className="text-xs font-medium text-neutral-600">
          훅 문장
        </label>
        <Input
          id="hook-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="첫 3초에 들어갈 한 줄"
          className="w-full"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <label htmlFor="hook-category" className="text-xs font-medium text-neutral-600">
            분류
          </label>
          <select
            id="hook-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as HookCategory)}
            className="min-h-11 rounded-lg border border-border-subtle bg-surface px-3 text-sm text-neutral-900"
          >
            {HOOK_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {HOOK_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="hook-handle" className="text-xs font-medium text-neutral-600">
            영감 준 계정
          </label>
          <Input
            id="hook-handle"
            value={sourceHandle}
            onChange={(e) => setSourceHandle(e.target.value)}
            placeholder="wearedone.kr"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="hook-views" className="text-xs font-medium text-neutral-600">
            원본 조회수
          </label>
          <Input
            id="hook-views"
            type="number"
            min={0}
            value={views}
            onChange={(e) => setViews(e.target.value)}
            className="w-32"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="hook-url" className="text-xs font-medium text-neutral-600">
          원본 링크
        </label>
        <Input
          id="hook-url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://instagram.com/reel/..."
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="hook-note" className="text-xs font-medium text-neutral-600">
          메모
        </label>
        <Input
          id="hook-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="언제 쓰면 좋을지"
          className="w-full"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-band-weak">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-lg px-3 text-sm font-medium text-neutral-600 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          취소
        </button>
      </div>
    </form>
  );
}
