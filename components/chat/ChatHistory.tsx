"use client";
import { MessageSquare, Trash2 } from "lucide-react";
import { relativeDay } from "@/lib/chat/relativeDay";
import type { ChatConversation } from "@/components/chat/useChat";

interface ChatHistoryProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ChatHistory({ conversations, activeId, onOpen, onDelete }: ChatHistoryProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="text-sm leading-relaxed text-neutral-500">
          아직 저장된 대화가 없습니다. 질문을 하나 하면 여기에 쌓입니다.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto px-2 py-2">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeId;
        return (
          <li key={conversation.id} className="relative">
            <button
              type="button"
              onClick={() => onOpen(conversation.id)}
              aria-current={isActive ? "true" : undefined}
              className={`w-full rounded-lg py-2 pl-3 pr-10 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                isActive ? "bg-surface-muted" : ""
              }`}
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare
                  size={13}
                  aria-hidden
                  className={`shrink-0 ${isActive ? "text-brand-600" : "text-neutral-400"}`}
                />
                <span className="truncate text-sm text-neutral-800">{conversation.title}</span>
              </span>
              <span className="mt-0.5 block pl-[1.25rem] text-xs text-neutral-400">
                {relativeDay(conversation.updatedAt)} · 메시지 {conversation.messageCount}개
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(conversation.id)}
              aria-label={`${conversation.title} 대화 삭제`}
              title="대화 삭제"
              className="absolute right-1 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-band-weak-soft hover:text-band-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <Trash2 size={14} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
