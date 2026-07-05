import Anthropic from "@anthropic-ai/sdk";
import type { TextModel } from "@/lib/llm/types";

// 테스트 주입용 최소 인터페이스
export interface AnthropicLike {
  messages: {
    create(args: unknown): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

interface Options {
  apiKey: string;
  model: string;
  client?: AnthropicLike;
}

// Anthropic(Claude) 네이티브 텍스트 생성 어댑터
export function createAnthropicTextModel(opts: Options): TextModel {
  const client: AnthropicLike =
    opts.client ?? (new Anthropic({ apiKey: opts.apiKey }) as unknown as AnthropicLike);

  return {
    async generate({ system, userText }) {
      const response = await client.messages.create({
        model: opts.model,
        max_tokens: 2048,
        thinking: { type: "adaptive" },
        system,
        messages: [{ role: "user", content: userText }],
      });
      const block = response.content.find((b) => b.type === "text" && b.text);
      if (!block?.text) throw new Error("응답에 텍스트가 없습니다");
      return block.text.trim();
    },
  };
}
