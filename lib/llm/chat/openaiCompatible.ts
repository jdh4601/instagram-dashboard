import OpenAI from "openai";
import type { ChatModel, ChatStreamArgs } from "@/lib/llm/types";

// 테스트 주입용 최소 인터페이스 (OpenAI SDK의 chat.completions.create 스트리밍 부분만)
interface OpenAIStreamChunk {
  choices: Array<{ delta?: { content?: string | null } }>;
}

interface OpenAILike {
  chat: {
    completions: {
      create(args: Record<string, unknown>): Promise<AsyncIterable<OpenAIStreamChunk>>;
    };
  };
}

interface Options {
  apiKey: string;
  baseURL: string;
  model: string;
  client?: OpenAILike;
}

const MAX_TOKENS = 2048;

// OpenAI 호환 제공자(OpenAI·Kimi·Gemini) 공용 스트리밍 어댑터
export function createOpenAICompatibleChatModel(opts: Options): ChatModel {
  const client: OpenAILike =
    opts.client ??
    (new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL }) as unknown as OpenAILike);

  return {
    async *stream({ system, turns, signal }: ChatStreamArgs) {
      const chunks = await client.chat.completions.create({
        model: opts.model,
        max_tokens: MAX_TOKENS,
        stream: true,
        messages: [
          { role: "system", content: system },
          ...turns.map((turn) => ({ role: turn.role, content: turn.content })),
        ],
        ...(signal ? { signal } : {}),
      });

      for await (const chunk of chunks) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      }
    },
  };
}
