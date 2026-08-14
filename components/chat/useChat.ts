"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readNdjson } from "@/lib/ui/ndjsonStream";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  provider?: string;
}

/** 대화 목록 한 줄. 서버가 주는 그대로이며 제목은 첫 질문에서 딴 것이다. */
export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface ChatState {
  messages: ChatMessage[];
  conversations: ChatConversation[];
  activeId: string | null;
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
  conversations: [],
  activeId: null,
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
  /** 새 대화를 연다. 지금 대화는 목록에 남는다. */
  startNew(): Promise<void>;
  open(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "요청을 처리하지 못했습니다";
}

export interface UseChatOptions {
  /** 질문하는 순간 열어 두고 있던 릴스. 서버가 이 릴스를 컨텍스트에 싣는다. */
  reelId?: string | null;
}

export function useChat(options: UseChatOptions = {}): UseChat {
  const [state, setState] = useState<ChatState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  // send는 한 번만 만들어져 컴포저에 내려가므로, 경로가 바뀔 때마다 바뀌는 값을
  // 클로저에 가두면 옛날 릴스를 계속 보낸다. ref로 최신 값을 읽는다.
  const reelIdRef = useRef<string | null>(null);
  reelIdRef.current = options.reelId ?? null;

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
          conversations: body.conversations ?? [],
          activeId: body.activeId ?? null,
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

  // 제목은 첫 질문에서 서버가 만들고, 순서는 마지막으로 쓴 시각으로 정해진다.
  // 두 규칙을 화면에서 따라 구현하면 어긋나므로 답변이 끝나면 목록을 다시 받는다.
  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) return;
      const body = await res.json();
      setState((prev) => ({
        ...prev,
        conversations: body.conversations ?? prev.conversations,
        activeId: body.activeId ?? prev.activeId,
      }));
    } catch {
      // 목록이 잠깐 예전 상태로 남는 것뿐이라 대화를 막지 않는다. 다음 갱신에 맞춰진다.
    }
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
        body: JSON.stringify(
          reelIdRef.current ? { message: trimmed, reelId: reelIdRef.current } : { message: trimmed },
        ),
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
      void refreshConversations();
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
  }, [refreshConversations]);

  /**
   * 대화를 바꾸는 세 동작은 같은 모양이다 — 스트리밍을 끊고, 서버가 정한 새 상태를
   * 그대로 받아 앉힌다. 스트리밍을 먼저 끊어야 진행 중이던 답변이 엉뚱한 대화에
   * 붙지 않는다 (서버는 끊긴 턴을 저장하지 않는다).
   */
  const switchTo = useCallback(
    async (path: string, method: "GET" | "POST" | "DELETE") => {
      stop();
      try {
        const res = await fetch(path, {
          method,
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error("대화를 불러오지 못했습니다");
        const body = await res.json();
        setState((prev) => ({
          ...prev,
          messages: body.messages ?? [],
          conversations: body.conversations ?? prev.conversations,
          activeId: body.activeId ?? null,
          streaming: null,
          sending: false,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({ ...prev, streaming: null, sending: false, error: errorText(error) }));
      }
    },
    [stop],
  );

  const startNew = useCallback(
    () => switchTo("/api/chat/conversations", "POST"),
    [switchTo],
  );

  const open = useCallback(
    (id: string) => switchTo(`/api/chat/conversations/${encodeURIComponent(id)}`, "GET"),
    [switchTo],
  );

  const remove = useCallback(
    (id: string) => switchTo(`/api/chat/conversations/${encodeURIComponent(id)}`, "DELETE"),
    [switchTo],
  );

  return { ...state, send, stop, startNew, open, remove };
}
