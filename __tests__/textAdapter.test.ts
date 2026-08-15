import {
  createOpenAICompatibleTextModel,
  createOpenAICompatibleVisionModel,
} from "@/lib/llm/openaiCompatible";
import { createAnthropicTextModel, createAnthropicVisionModel } from "@/lib/llm/anthropic";

test("OpenAI 호환 텍스트 어댑터는 content를 반환하고 이미지를 보내지 않는다", async () => {
  let captured: unknown = null;
  const fakeClient = {
    chat: {
      completions: {
        create: async (args: unknown) => {
          captured = args;
          return { choices: [{ message: { content: "생성결과" } }] };
        },
      },
    },
  };
  const model = createOpenAICompatibleTextModel({
    apiKey: "k", baseURL: "https://x/v1", model: "m", client: fakeClient,
  });
  const text = await model.generate({ system: "sys", userText: "대본 만들어줘" });
  expect(text).toBe("생성결과");
  expect(JSON.stringify(captured)).not.toContain("image_url");
});

test("Anthropic 텍스트 어댑터는 text 블록을 반환한다", async () => {
  const fakeClient = {
    messages: {
      create: async () => ({ content: [{ type: "text", text: "클로드 생성" }] }),
    },
  };
  const model = createAnthropicTextModel({ apiKey: "k", model: "claude-opus-4-8", client: fakeClient });
  const text = await model.generate({ system: "s", userText: "u" });
  expect(text).toBe("클로드 생성");
});

test("OpenAI 호환 비전 어댑터는 프레임과 시간표를 함께 보낸다", async () => {
  let captured: unknown = null;
  const fakeClient = {
    chat: {
      completions: {
        create: async (args: unknown) => {
          captured = args;
          return { choices: [{ message: { content: "{}" } }] };
        },
      },
    },
  };
  const model = createOpenAICompatibleVisionModel({
    apiKey: "k",
    baseURL: "https://x/v1",
    model: "m",
    client: fakeClient,
  });
  await model.generate({
    system: "s",
    userText: "u",
    images: [{ label: "[프레임 2초]", mediaType: "image/jpeg", base64: "YWJj" }],
  });

  expect(JSON.stringify(captured)).toContain("[프레임 2초]");
  expect(JSON.stringify(captured)).toContain("data:image/jpeg;base64,YWJj");
});

test("Anthropic 비전 어댑터는 base64 이미지 블록을 보낸다", async () => {
  let captured: unknown = null;
  const fakeClient = {
    messages: {
      create: async (args: unknown) => {
        captured = args;
        return { content: [{ type: "text", text: "{}" }] };
      },
    },
  };
  const model = createAnthropicVisionModel({
    apiKey: "k",
    model: "claude-opus-4-8",
    client: fakeClient,
  });
  await model.generate({
    system: "s",
    userText: "u",
    images: [{ label: "[프레임 4초]", mediaType: "image/jpeg", base64: "YWJj" }],
  });

  expect(JSON.stringify(captured)).toContain('"type":"image"');
  expect(JSON.stringify(captured)).toContain('"media_type":"image/jpeg"');
});
