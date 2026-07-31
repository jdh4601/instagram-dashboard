"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readNdjson } from "@/lib/ui/ndjsonStream";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  provider?: string;
}

interface ChatState {
  messages: ChatMessage[];
  /** 스트리밍 중인 답변. 완료되면 messages로 옮겨간다. */
  streaming: string | null;
  sending: boolean;
  loading: boolean;
  /**
   * 이 배포에 챗봇 기능이 존재하는지. 로컬 CLI를 띄울 수 없는 환경에서는 서버가
   * 404로 답하고, 그때는 패널을 아예 그리지 않는다. available과 다른 축이다 —
   * 이건 "기능 없음", available은 "기능은 있는데 제공자 미설정"이다.
   */
  enabled: boolean;
  /** 제공자가 설정돼 쓸 수 있는 상태인지. */
  available: boolean;
  /** 쓸 수 없을 때의 이유 (설정 안내에 그대로 노출). */
  reason: string | null;
  providerLabel: string | null;
  error: string | null;
}

const INITIAL: ChatState = {
  messages: [],
  streaming: null,
  sending: false,
  loading: true,
  enabled: true,
  available: false,
  reason: null,
  providerLabel: null,
  error: null,
};

export interface UseChat extends ChatState {
  send(message: string): Promise<void>;
  stop(): void;
  reset(): Promise<void>;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "요청을 처리하지 못했습니다";
}

export function useChat(): UseChat {
  const [state, setState] = useState<ChatState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/chat")
      .then(async (res) => {
        if (res.status === 404) return { enabled: false };
        if (!res.ok) throw new Error("챗봇 상태를 확인하지 못했습니다");
        return { enabled: true, ...(await res.json()) };
      })
      .then((body) => {
        if (!active) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          enabled: body.enabled,
          messages: body.messages ?? [],
          available: Boolean(body.available),
          reason: body.reason ?? null,
          providerLabel: body.label ?? null,
        }));
      })
      .catch(() => {
        if (!active) return;
        setState((prev) => ({ ...prev, loading: false, available: false }));
      });

    return () => {
      active = false;
    };
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // 패널이 사라질 때 진행 중인 요청을 남기지 않는다.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (trimmed === "") return;

    const controller = new AbortController();
    abortRef.current = controller;

    const optimistic: ChatMessage = {
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, optimistic],
      streaming: "",
      sending: true,
      error: null,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const failed = await res.json().catch(() => ({}));
        throw new Error(failed.error ?? "답변을 받지 못했습니다");
      }

      let answer = "";
      let streamError: string | null = null;
      let finished: ChatMessage | null = null;

      for await (const event of readNdjson(res.body)) {
        const parsed = event as { type?: string } & Record<string, unknown>;
        if (parsed.type === "delta") {
          answer += String(parsed.text ?? "");
          setState((prev) => ({ ...prev, streaming: answer }));
        } else if (parsed.type === "done") {
          finished = parsed.message as ChatMessage;
        } else if (parsed.type === "error") {
          streamError = String(parsed.error);
        }
      }

      if (streamError !== null) throw new Error(streamError);

      setState((prev) => ({
        ...prev,
        // 서버가 저장한 레코드를 우선 쓰되, done이 없으면 받은 델타로 채운다.
        messages: [
          ...prev.messages,
          finished ?? {
            role: "assistant",
            content: answer,
            createdAt: new Date().toISOString(),
          },
        ],
        streaming: null,
        sending: false,
      }));
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      setState((prev) => ({
        ...prev,
        streaming: null,
        sending: false,
        error: aborted ? null : errorText(error),
      }));
    } finally {
      abortRef.current = null;
    }
  }, []);

  const reset = useCallback(async () => {
    stop();
    await fetch("/api/chat", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }).catch(() => undefined);
    setState((prev) => ({ ...prev, messages: [], streaming: null, error: null }));
  }, [stop]);

  return { ...state, send, stop, reset };
}
