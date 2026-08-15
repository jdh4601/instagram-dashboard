"use client";
import { useEffect, useRef } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  parseChatText,
  type EmphasisTone,
  type MetricRow,
  type TextBlock,
  type TextSegment,
} from "@/lib/chat/renderText";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import type { ChatMessage } from "@/components/chat/useChat";

interface ChatMessagesProps {
  messages: ChatMessage[];
  streaming: string | null;
  error: string | null;
}

const TONE_TEXT = {
  strong: "text-band-strong",
  weak: "text-band-weak",
} as const;

/**
 * 색은 방향을 아는 수치에만 쓴다. 증감 부호와 기준 비교(지표 행)가 그 둘이다.
 * 부호 없는 수치까지 카드 색을 물려주면, 약점 카드가 대조용으로 인용한 좋은 수치
 * ("캐러셀은 0.73%가 나오는데")까지 빨갛게 칠해져 판정을 거짓으로 만든다.
 */
function emphasisClass(emphasis: EmphasisTone | undefined): string {
  if (emphasis === undefined) return "";
  if (emphasis === "up") return `font-semibold tabular-nums ${TONE_TEXT.strong}`;
  if (emphasis === "down") return `font-semibold tabular-nums ${TONE_TEXT.weak}`;
  return "font-semibold tabular-nums";
}

function Segments({ segments }: { segments: TextSegment[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        const className = [segment.bold ? "font-semibold" : "", emphasisClass(segment.emphasis)]
          .filter(Boolean)
          .join(" ");
        return (
          <span key={index} className={className || undefined}>
            {segment.text}
          </span>
        );
      })}
    </>
  );
}

function DiagnosisCard({ block }: { block: TextBlock }) {
  const isStrength = block.kind === "strength";
  const Icon = isStrength ? TrendingUp : TrendingDown;
  const tone = isStrength ? "strong" : "weak";

  return (
    <div
      className={
        isStrength
          ? "rounded-xl border border-band-strong-border bg-band-strong-soft px-3 py-2"
          : "rounded-xl border border-band-weak-border bg-band-weak-soft px-3 py-2"
      }
    >
      <div className="flex items-start gap-1.5">
        <Icon size={14} className={`mt-0.5 shrink-0 ${TONE_TEXT[tone]}`} aria-hidden />
        <span className={`text-xs font-semibold ${TONE_TEXT[tone]}`}>{block.title}</span>
      </div>
      {block.segments.length > 0 && (
        <p className="mt-1 pl-[1.375rem] leading-relaxed text-neutral-700">
          <Segments segments={block.segments} />
        </p>
      )}
    </div>
  );
}

function MetricLine({ metric }: { metric: MetricRow }) {
  const valueClass = metric.tone ? TONE_TEXT[metric.tone] : "text-neutral-800";

  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg bg-surface-muted px-2.5 py-1.5">
      <span className="min-w-0 truncate text-xs text-neutral-500">{metric.name}</span>
      <span className="flex shrink-0 items-baseline gap-1.5">
        <span className={`font-semibold tabular-nums ${valueClass}`}>{metric.value}</span>
        {metric.benchmark !== undefined && (
          <span className="text-xs tabular-nums text-neutral-400">기준 {metric.benchmark}</span>
        )}
      </span>
    </div>
  );
}

function Block({ block }: { block: TextBlock }) {
  if (block.kind === "strength" || block.kind === "weakness") {
    return <DiagnosisCard block={block} />;
  }

  if (block.kind === "metric" && block.metric) {
    return <MetricLine metric={block.metric} />;
  }

  if (block.kind === "heading") {
    return (
      <div className="flex items-center gap-2 pt-2 first:pt-0">
        <span className="text-xs font-semibold text-neutral-500">
          <Segments segments={block.segments} />
        </span>
        <span aria-hidden className="h-px flex-1 bg-border-subtle" />
      </div>
    );
  }

  if (block.kind === "paragraph") {
    return (
      <p className="leading-relaxed">
        <Segments segments={block.segments} />
      </p>
    );
  }

  return (
    <div className="flex gap-1.5 leading-relaxed">
      <span aria-hidden className="shrink-0 text-neutral-400">
        {block.kind === "numbered" ? block.marker : "·"}
      </span>
      <span className="min-w-0">
        <Segments segments={block.segments} />
      </span>
    </div>
  );
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
            <ThinkingIndicator />
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
