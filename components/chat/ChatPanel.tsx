"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, RotateCcw, Sparkles, X } from "lucide-react";
import { useChat } from "@/components/chat/useChat";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatSuggestions } from "@/components/chat/ChatSuggestions";

const STORAGE_KEY = "chat-open";

export function ChatPanel() {
  const chat = useChat();
  // 서버 렌더와 어긋나지 않도록 첫 페인트 뒤에 저장된 상태를 읽는다.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(window.localStorage.getItem(STORAGE_KEY) !== "closed");
  }, []);

  function toggle(next: boolean) {
    setOpen(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
  }

  // 서버가 이 기능을 제공하지 않는 배포에서는 버튼조차 노출하지 않는다.
  if (!chat.enabled) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => toggle(true)}
        aria-label="계정 진단 AI 열기"
        className="fixed bottom-4 right-4 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-card-hover transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <MessageSquare size={20} />
      </button>
    );
  }

  const empty = chat.messages.length === 0 && chat.streaming === null;

  return (
    <>
      {/* xl 미만에서는 대시보드를 덮는 드로어라 바깥을 눌러 닫을 수 있어야 한다. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => toggle(false)}
        className="fixed inset-0 z-20 bg-neutral-900/20 xl:hidden"
      />
      <aside
        aria-label="계정 진단 AI"
        className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[26rem] flex-col border-l border-border-subtle bg-surface shadow-card-hover xl:sticky xl:top-0 xl:z-0 xl:h-screen xl:w-[26rem] xl:shrink-0 xl:shadow-none"
      >
        <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles size={16} className="shrink-0 text-brand-600" />
            <span className="truncate text-sm font-semibold text-neutral-800">계정 진단 AI</span>
            {chat.providerLabel && (
              <span className="hidden truncate text-xs text-neutral-400 sm:inline">
                {chat.providerLabel}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {chat.messages.length > 0 && (
              <button
                type="button"
                onClick={chat.reset}
                aria-label="대화 초기화"
                title="대화 초기화"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-surface-muted hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <RotateCcw size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => toggle(false)}
              aria-label="닫기"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-surface-muted hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {!chat.loading && !chat.available && (
          <p className="border-b border-band-ok-border bg-band-ok-soft px-4 py-2.5 text-xs leading-relaxed text-band-ok">
            {chat.reason ?? "챗봇을 사용할 수 없습니다."}{" "}
            <Link href="/settings" className="font-medium underline">
              설정으로 이동
            </Link>
          </p>
        )}

        {empty ? (
          <ChatSuggestions disabled={!chat.available} onPick={chat.send} />
        ) : (
          <ChatMessages
            messages={chat.messages}
            streaming={chat.streaming}
            error={chat.error}
          />
        )}

        <ChatComposer
          disabled={!chat.available}
          sending={chat.sending}
          onSend={chat.send}
          onStop={chat.stop}
        />
      </aside>
    </>
  );
}
