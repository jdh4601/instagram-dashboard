import Anthropic from "@anthropic-ai/sdk";
import type { ChatModel, ChatStreamArgs } from "@/lib/llm/types";

// 테스트 주입용 최소 인터페이스. SDK의 messages.stream 부분만 쓴다.
interface AnthropicStreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
}

interface AnthropicLike {
  messages: {
    stream(args: Record<string, unknown>): AsyncIterable<AnthropicStreamEvent>;
  };
}

interface Options {
  apiKey: string;
  model: string;
  client?: AnthropicLike;
}

const MAX_TOKENS = 2048;

export function createAnthropicChatModel(opts: Options): ChatModel {
  const client: AnthropicLike =
    opts.client ?? (new Anthropic({ apiKey: opts.apiKey }) as unknown as AnthropicLike);

  return {
    async *stream({ system, turns, signal }: ChatStreamArgs) {
      const events = client.messages.stream({
        model: opts.model,
        max_tokens: MAX_TOKENS,
        system,
        messages: turns.map((turn) => ({ role: turn.role, content: turn.content })),
        ...(signal ? { signal } : {}),
      });

      for await (const event of events) {
        if (event.type !== "content_block_delta") continue;
        const text = event.delta?.type === "text_delta" ? event.delta.text : undefined;
        if (text) yield text;
      }
    },
  };
}
