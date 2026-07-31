"use client";
import Link from "next/link";
import { RotateCcw, Sparkles } from "lucide-react";
import { useChat } from "@/components/chat/useChat";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatSuggestions } from "@/components/chat/ChatSuggestions";

export function ChatPanel() {
  const chat = useChat();

  // 서버가 이 기능을 제공하지 않는 배포에서는 패널 자체를 내보내지 않는다.
  if (!chat.enabled) return null;

  const empty = chat.messages.length === 0 && chat.streaming === null;

  return (
    // xl 이상에서는 대시보드 옆에 붙어 화면 높이만큼 서고, 그 아래 폭에서는 대시보드
    // 다음에 쌓인다. 좁은 화면에서 오버레이로 덮으면 대시보드를 볼 수 없게 된다.
    <aside
      aria-label="계정 진단 AI"
      className="flex h-[34rem] w-full shrink-0 flex-col border-t border-border-subtle bg-surface xl:sticky xl:top-0 xl:h-screen xl:w-[26rem] xl:border-t-0 xl:border-l"
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
        {chat.messages.length > 0 && (
          <button
            type="button"
            onClick={chat.reset}
            aria-label="대화 초기화"
            title="대화 초기화"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-surface-muted hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <RotateCcw size={15} />
          </button>
        )}
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
  );
}
