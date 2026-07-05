import OpenAI from "openai";
import type { TextModel } from "@/lib/llm/types";

// 테스트 주입용 최소 인터페이스 (OpenAI SDK의 chat.completions.create 부분만)
export interface OpenAILike {
  chat: {
    completions: {
      create(args: unknown): Promise<{ choices: Array<{ message: { content: string | null } }> }>;
    };
  };
}

interface Options {
  apiKey: string;
  baseURL: string;
  model: string;
  client?: OpenAILike;
}

// OpenAI 호환 제공자 텍스트 생성 어댑터 (이미지 없음)
export function createOpenAICompatibleTextModel(opts: Options): TextModel {
  const client: OpenAILike =
    opts.client ?? (new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL }) as unknown as OpenAILike);

  return {
    async generate({ system, userText }) {
      const response = await client.chat.completions.create({
        model: opts.model,
        max_tokens: 2048,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userText },
        ],
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("응답이 비어 있습니다");
      return content.trim();
    },
  };
}
