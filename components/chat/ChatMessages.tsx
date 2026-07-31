"use client";
import { useEffect, useRef } from "react";
import { parseChatText, type TextBlock } from "@/lib/chat/renderText";
import type { ChatMessage } from "@/components/chat/useChat";

interface ChatMessagesProps {
  messages: ChatMessage[];
  streaming: string | null;
  error: string | null;
}

function Blocks({ text }: { text: string }) {
  const blocks = parseChatText(text);
  return (
    <div className="space-y-1.5">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: TextBlock }) {
  const content = block.segments.map((segment, index) =>
    segment.bold ? (
      <strong key={index} className="font-semibold">
        {segment.text}
      </strong>
    ) : (
      <span key={index}>{segment.text}</span>
    ),
  );

  if (block.kind === "paragraph") return <p className="leading-relaxed">{content}</p>;

  return (
    <div className="flex gap-1.5 leading-relaxed">
      <span aria-hidden className="shrink-0 text-neutral-400">
        {block.kind === "numbered" ? block.marker : "·"}
      </span>
      <span className="min-w-0">{content}</span>
    </div>
  );
}

export function ChatMessages({ messages, streaming, error }: ChatMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // 새 델타가 올 때마다 바닥을 따라간다.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, streaming]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
      {messages.map((message, index) =>
        message.role === "user" ? (
          <div key={index} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2 text-white">
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
          </div>
        ) : (
          <div key={index} className="text-neutral-800">
            <Blocks text={message.content} />
          </div>
        ),
      )}

      {streaming !== null && (
        <div className="text-neutral-800">
          {streaming === "" ? (
            <p className="text-neutral-400">진단하는 중…</p>
          ) : (
            <Blocks text={streaming} />
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-band-weak-border bg-band-weak-soft px-3 py-2 text-band-weak"
        >
          {error}
        </p>
      )}

      <div ref={endRef} />
    </div>
  );
}
