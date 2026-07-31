"use client";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

interface ChatComposerProps {
  disabled: boolean;
  sending: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
}

export function ChatComposer({ disabled, sending, onSend, onStop }: ChatComposerProps) {
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || sending || draft.trim() === "") return;
    onSend(draft);
    setDraft("");
  }

  // Enter로 보내고 Shift+Enter로 줄을 바꾼다. 조합 중(한글 입력)일 때는 가로채지 않는다.
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit(event);
  }

  return (
    <form onSubmit={submit} className="border-t border-border-subtle p-3">
      <div className="flex items-end gap-2 rounded-2xl border border-border-subtle bg-surface px-3 py-2 focus-within:border-brand-400">
        <label className="sr-only" htmlFor="chat-input">
          계정에 대해 질문하기
        </label>
        <textarea
          id="chat-input"
          rows={1}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "설정에서 제공자를 먼저 선택하세요" : "계정에 대해 물어보세요"}
          className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-sm leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
        />
        {sending ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="생성 중단"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 transition-colors hover:bg-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || draft.trim() === ""}
            aria-label="보내기"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-neutral-200 disabled:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <ArrowUp size={16} />
          </button>
        )}
      </div>
    </form>
  );
}
