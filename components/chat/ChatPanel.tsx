"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, PanelRightClose, Plus, Sparkles } from "lucide-react";
import { useChat } from "@/components/chat/useChat";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatSuggestions } from "@/components/chat/ChatSuggestions";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { readPanelExpanded, writePanelExpanded } from "@/lib/ui/panelPreference";

const ICON_BUTTON =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-surface-muted hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

interface ChatPanelProps {
  /** 릴스 상세를 보고 있다면 그 릴스 id. 질문에 이름이 없어도 컨텍스트로 실린다. */
  reelId?: string | null;
}

export function ChatPanel({ reelId = null }: ChatPanelProps = {}) {
  const chat = useChat({ reelId });
  // 서버 렌더와 첫 클라이언트 렌더가 어긋나면 하이드레이션이 깨진다. 저장된 값은
  // 마운트 뒤에 읽고, 그 전까지는 기본값(열림)으로 그린다.
  const [expanded, setExpanded] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setExpanded(readPanelExpanded(globalThis.localStorage ?? null));
  }, []);

  function toggleExpanded(next: boolean) {
    setExpanded(next);
    writePanelExpanded(globalThis.localStorage ?? null, next);
  }

  // 서버가 이 기능을 제공하지 않는 배포에서는 패널 자체를 내보내지 않는다.
  if (!chat.enabled) return null;

  const empty = chat.messages.length === 0 && chat.streaming === null;

  async function startNew() {
    setShowHistory(false);
    await chat.startNew();
  }

  async function open(id: string) {
    setShowHistory(false);
    await chat.open(id);
  }

  return (
    <>
      {/* 접혀 있을 때 오른쪽 가장자리에 남는 손잡이 */}
      {!expanded && (
        <button
          type="button"
          onClick={() => toggleExpanded(true)}
          aria-label="계정 진단 AI 열기"
          className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-1.5 rounded-l-xl border border-r-0 border-border-subtle bg-surface py-3 pl-2 pr-1.5 shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Sparkles size={15} className="text-brand-600" aria-hidden />
          <span className="text-xs font-semibold text-neutral-700 [writing-mode:vertical-rl]">
            진단 AI
          </span>
        </button>
      )}

      {expanded && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => toggleExpanded(false)}
          className="fixed inset-0 z-30 bg-neutral-900/20 xl:hidden"
        />
      )}

      {/* 접히면 어느 폭에서든 사라진다. xl 이상에서는 문서 흐름에 붙어 본문이 그 폭을
          되찾고, 그 아래에서는 본문 위에 덮이는 서랍으로 뜬다. */}
      <aside
        aria-label="계정 진단 AI"
        className={`w-full max-w-[26rem] flex-col border-l border-border-subtle bg-surface shadow-card-hover ${
          expanded
            ? "fixed inset-y-0 right-0 z-40 flex xl:sticky xl:top-0 xl:z-0 xl:h-screen xl:w-[26rem] xl:max-w-none xl:shrink-0 xl:shadow-none"
            : "hidden"
        }`}
      >
        <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
          {showHistory ? (
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="flex min-w-0 items-center gap-1.5 rounded-lg text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <ArrowLeft size={16} className="shrink-0 text-neutral-500" aria-hidden />
              기록
            </button>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles size={16} className="shrink-0 text-brand-600" aria-hidden />
              <span className="truncate text-sm font-semibold text-neutral-800">계정 진단 AI</span>
              {chat.providerLabel && (
                <span className="hidden truncate text-xs text-neutral-400 sm:inline">
                  {chat.providerLabel}
                </span>
              )}
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1">
            {!showHistory && (
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                aria-label="이전 대화 기록"
                title="이전 대화 기록"
                className={ICON_BUTTON}
              >
                <History size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={startNew}
              aria-label="새 대화"
              title="새 대화"
              className={ICON_BUTTON}
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={() => toggleExpanded(false)}
              aria-label="패널 접기"
              title="접기"
              className={ICON_BUTTON}
            >
              <PanelRightClose size={16} />
            </button>
          </div>
        </header>

        {!chat.loading && !chat.available && !showHistory && (
          <p className="border-b border-band-ok-border bg-band-ok-soft px-4 py-2.5 text-xs leading-relaxed text-band-ok">
            {chat.reason ?? "챗봇을 사용할 수 없습니다."}{" "}
            <Link href="/settings" className="font-medium underline">
              설정으로 이동
            </Link>
          </p>
        )}

        {showHistory ? (
          <ChatHistory
            conversations={chat.conversations}
            activeId={chat.activeId}
            onOpen={open}
            onDelete={chat.remove}
          />
        ) : empty ? (
          <ChatSuggestions disabled={!chat.available} onPick={chat.send} />
        ) : (
          <ChatMessages
            messages={chat.messages}
            streaming={chat.streaming}
            error={chat.error}
          />
        )}

        {!showHistory && (
          <ChatComposer
            disabled={!chat.available}
            sending={chat.sending}
            onSend={chat.send}
            onStop={chat.stop}
          />
        )}
      </aside>
    </>
  );
}
