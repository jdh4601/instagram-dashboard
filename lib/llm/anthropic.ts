import Anthropic from "@anthropic-ai/sdk";
import type { TextModel, VisionModel } from "@/lib/llm/types";

// 테스트 주입용 최소 인터페이스
interface AnthropicLike {
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

/** Anthropic의 이미지 블록 형식으로 프레임과 타임스탬프를 번갈아 보낸다. */
export function createAnthropicVisionModel(opts: Options): VisionModel {
  const client: AnthropicLike =
    opts.client ?? (new Anthropic({ apiKey: opts.apiKey }) as unknown as AnthropicLike);

  return {
    async generate({ system, userText, images }) {
      const content: unknown[] = [{ type: "text", text: userText }];
      for (const image of images) {
        content.push(
          { type: "text", text: image.label },
          {
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: image.base64 },
          },
        );
      }
      const response = await client.messages.create({
        model: opts.model,
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        system,
        messages: [{ role: "user", content }],
      });
      const block = response.content.find((item) => item.type === "text" && item.text);
      if (!block?.text) throw new Error("응답에 텍스트가 없습니다");
      return block.text.trim();
    },
  };
}
