import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import { createAnthropicChatModel } from "@/lib/llm/chat/anthropic";
import { createOpenAICompatibleChatModel } from "@/lib/llm/chat/openaiCompatible";
import { createLocalCliChatModel } from "@/lib/llm/chat/localCli";
import type { ChatModel } from "@/lib/llm/types";

async function collect(model: ChatModel, signal?: AbortSignal): Promise<string> {
  let out = "";
  for await (const delta of model.stream({
    system: "너는 분석가다",
    turns: [{ role: "user", content: "병목이 어디야?" }],
    signal,
  })) {
    out += delta;
  }
  return out;
}

// ── Anthropic ────────────────────────────────────────────────────────────────

test("Anthropic 어댑터는 텍스트 델타만 이어 붙인다", async () => {
  const model = createAnthropicChatModel({
    apiKey: "k",
    model: "claude-test",
    client: {
      messages: {
        async *stream() {
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "도달은 " } };
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "충분합니다" } };
          // 텍스트가 아닌 이벤트가 섞여 들어와도 출력에 새면 안 된다.
          yield { type: "message_stop" };
        },
      },
    },
  });

  expect(await collect(model)).toBe("도달은 충분합니다");
});

test("Anthropic 어댑터는 system과 turns를 그대로 전달한다", async () => {
  let captured: Record<string, unknown> = {};
  const model = createAnthropicChatModel({
    apiKey: "k",
    model: "claude-test",
    client: {
      messages: {
        async *stream(args: Record<string, unknown>) {
          captured = args;
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "ok" } };
        },
      },
    },
  });

  await collect(model);
  expect(captured.system).toBe("너는 분석가다");
  expect(captured.messages).toEqual([{ role: "user", content: "병목이 어디야?" }]);
});

// ── OpenAI 호환 ──────────────────────────────────────────────────────────────

test("OpenAI 호환 어댑터는 choices 델타를 이어 붙인다", async () => {
  const model = createOpenAICompatibleChatModel({
    apiKey: "k",
    baseURL: "https://example.test/v1",
    model: "gpt-test",
    client: {
      chat: {
        completions: {
          async create() {
            return (async function* () {
              yield { choices: [{ delta: { content: "팔로우 " } }] };
              yield { choices: [{ delta: { content: "전환이 약합니다" } }] };
              yield { choices: [{ delta: {} }] };
            })();
          },
        },
      },
    },
  });

  expect(await collect(model)).toBe("팔로우 전환이 약합니다");
});

test("OpenAI 호환 어댑터는 system을 첫 메시지로 넣는다", async () => {
  let captured: Record<string, unknown> = {};
  const model = createOpenAICompatibleChatModel({
    apiKey: "k",
    baseURL: "https://example.test/v1",
    model: "gpt-test",
    client: {
      chat: {
        completions: {
          async create(args: Record<string, unknown>) {
            captured = args;
            return (async function* () {
              yield { choices: [{ delta: { content: "ok" } }] };
            })();
          },
        },
      },
    },
  });

  await collect(model);
  expect(captured.stream).toBe(true);
  expect((captured.messages as { role: string }[])[0]).toEqual({
    role: "system",
    content: "너는 분석가다",
  });
});

// ── 로컬 CLI ─────────────────────────────────────────────────────────────────

interface FakeChild extends EventEmitter {
  stdout: Readable;
  stderr: Readable;
  stdin: Writable;
  killed: boolean;
  kill(signal?: string): boolean;
}

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new Readable({ read() {} });
  child.stderr = new Readable({ read() {} });
  child.stdin = new Writable({ write(_c, _e, cb) { cb(); } });
  child.killed = false;
  child.kill = (_signal?: string) => {
    child.killed = true;
    return true;
  };
  return child;
}

test("CLI 어댑터는 stdout 청크를 델타로 흘린다", async () => {
  const child = fakeChild();
  const model = createLocalCliChatModel({
    providerId: "claude-cli",
    spawn: () => child,
  });

  const promise = collect(model);
  setTimeout(() => {
    child.stdout.push("계정 도달은 ");
    child.stdout.push("나쁘지 않습니다");
    child.stdout.push(null);
    child.emit("close", 0);
  }, 0);

  expect(await promise).toBe("계정 도달은 나쁘지 않습니다");
});

test("CLI 어댑터는 프롬프트를 argv가 아니라 stdin으로 넘긴다", async () => {
  const child = fakeChild();
  let written = "";
  child.stdin = new Writable({
    write(chunk, _e, cb) {
      written += String(chunk);
      cb();
    },
  });

  let capturedArgs: string[] = [];
  const model = createLocalCliChatModel({
    providerId: "claude-cli",
    spawn: (_command, args) => {
      capturedArgs = args;
      return child;
    },
  });

  const promise = collect(model);
  setTimeout(() => {
    child.stdout.push(null);
    child.emit("close", 0);
  }, 0);
  await promise;

  // 프롬프트 내용이 인자에 실리면 길이 제한과 인용 문제가 생긴다.
  expect(capturedArgs.join(" ")).not.toContain("병목이 어디야?");
  expect(written).toContain("너는 분석가다");
  expect(written).toContain("병목이 어디야?");
});

test("CLI가 0이 아닌 코드로 끝나면 stderr를 담은 오류를 던진다", async () => {
  const child = fakeChild();
  const model = createLocalCliChatModel({
    providerId: "codex-cli",
    spawn: () => child,
  });

  const promise = collect(model);
  setTimeout(() => {
    child.stderr.push("not logged in");
    child.stderr.push(null);
    child.stdout.push(null);
    child.emit("close", 1);
  }, 0);

  await expect(promise).rejects.toThrow(/not logged in/);
});

test("CLI 실행 파일이 없으면 설치 안내가 담긴 오류를 던진다", async () => {
  const child = fakeChild();
  const model = createLocalCliChatModel({
    providerId: "gemini-cli",
    spawn: () => child,
  });

  const promise = collect(model);
  setTimeout(() => {
    const error = new Error("spawn gemini ENOENT") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    child.emit("error", error);
  }, 0);

  await expect(promise).rejects.toThrow(/gemini/);
});

test("타임아웃이 지나면 자식 프로세스를 종료한다", async () => {
  const child = fakeChild();
  const model = createLocalCliChatModel({
    providerId: "claude-cli",
    timeoutMs: 10,
    spawn: () => child,
  });

  await expect(collect(model)).rejects.toThrow(/시간/);
  expect(child.killed).toBe(true);
});

test("소비자가 중단하면 자식 프로세스를 종료한다", async () => {
  const child = fakeChild();
  const controller = new AbortController();
  const model = createLocalCliChatModel({
    providerId: "claude-cli",
    spawn: () => child,
  });

  const promise = collect(model, controller.signal);
  setTimeout(() => controller.abort(), 0);

  await expect(promise).rejects.toThrow();
  expect(child.killed).toBe(true);
});
