import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Reel, AccountSnapshot, AccountProfile } from "@/lib/schemas";
import type { ChatModel } from "@/lib/llm/types";

const dataDir = mkdtempSync(join(tmpdir(), "chat-route-"));

let localRuntime = true;
let chatModel: ChatModel = {
  // eslint-disable-next-line require-yield
  async *stream() {
    throw new Error("테스트가 모델을 지정하지 않았습니다");
  },
};
let resolveError: Error | null = null;

vi.mock("@/lib/runtime/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/runtime/config")>(
    "@/lib/runtime/config",
  );
  return {
    ...actual,
    resolveRuntimeConfig: () => ({ ...actual.resolveRuntimeConfig(), dataDir, isLocalRuntime: localRuntime }),
  };
});

vi.mock("@/lib/llm/chat", () => ({
  getChatModel: async () => {
    if (resolveError) throw resolveError;
    return {
      provider: "anthropic",
      label: "Anthropic (Claude)",
      modelName: "claude-opus-4-8",
      model: chatModel,
    };
  },
}));

vi.mock("@/lib/llm/chat/cliDetect", () => ({
  detectAvailableClis: async () => ({
    "claude-cli": true,
    "codex-cli": false,
    "gemini-cli": true,
  }),
}));

const reels: Reel[] = [
  {
    id: "reel-1",
    postedAt: "2026-07-20T09:00:00Z",
    durationSec: 30,
    views: 1000,
    reach: 800,
    likes: 20,
    comments: 2,
    saves: 4,
    shares: 6,
    avgWatchTimeSec: 10,
    caption: "가격 정하는 법",
  },
];
const snapshots: AccountSnapshot[] = [
  { date: "2026-07-30", followerCount: 300, reachLast7d: 3000, profileViewsLast7d: 400, followsLast7d: 20 },
];
const profile: AccountProfile = {
  username: "tester",
  followersCount: 300,
  mediaCount: 10,
  updatedAt: "2026-07-30T00:00:00Z",
};

vi.mock("@/lib/store", () => ({
  getRepository: () => ({ list: async () => reels }),
  getAccountRepository: () => ({ list: async () => snapshots }),
  getProfileRepository: () => ({ get: async () => profile }),
}));

import { GET, POST } from "@/app/api/chat/route";
import {
  GET as listConversations,
  POST as createConversation,
} from "@/app/api/chat/conversations/route";
import {
  GET as openConversation,
  DELETE as deleteConversation,
} from "@/app/api/chat/conversations/[id]/route";
import { getChatStore } from "@/lib/chat";

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { host: "localhost:3000", "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function readEvents(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

function modelYielding(...deltas: string[]): ChatModel {
  return {
    async *stream() {
      for (const delta of deltas) yield delta;
    },
  };
}

// 저장소는 파일을 매번 다시 읽으므로, 파일만 지우면 테스트가 서로 격리된다.
beforeEach(async () => {
  localRuntime = true;
  resolveError = null;
  const { rmSync } = await import("node:fs");
  rmSync(join(dataDir, "chat.json"), { force: true });
});

function conversationRequest(method: "GET" | "POST" | "DELETE", path = ""): Request {
  return new Request(`http://localhost:3000/api/chat/conversations${path}`, {
    method,
    headers: { host: "localhost:3000", "Content-Type": "application/json" },
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** 한 대화를 만들고 질문 하나를 남긴 뒤 그 id를 준다. */
async function askIn(message: string): Promise<string> {
  chatModel = modelYielding("답변");
  await readEvents(await POST(post({ message })));
  return (await getChatStore().activeId())!;
}

test("POST는 델타를 흘리고 done으로 끝난다", async () => {
  chatModel = modelYielding("도달은 ", "충분합니다");

  const events = await readEvents(await POST(post({ message: "병목이 어디야?" })));

  expect(events.map((e) => e.type)).toEqual(["delta", "delta", "done"]);
  expect(events.slice(0, 2).map((e) => e.text).join("")).toBe("도달은 충분합니다");
});

test("POST는 사용자 메시지와 답변을 대화에 저장한다", async () => {
  chatModel = modelYielding("답변입니다");
  await readEvents(await POST(post({ message: "병목이 어디야?" })));

  const stored = await getChatStore().get();
  expect(stored.map((m) => m.role)).toEqual(["user", "assistant"]);
  expect(stored[1].content).toBe("답변입니다");
});

test("보고 있는 릴스 id를 함께 보내면 지목 없이도 그 릴스 상세가 실린다", async () => {
  let system = "";
  chatModel = {
    async *stream(request: { system: string }) {
      system = request.system;
      yield "답변";
    },
  };

  // "이거"는 불용어라 캡션 겹침으로는 아무 릴스도 지목되지 않는다.
  await readEvents(await POST(post({ message: "이거 훅 왜 약해?", reelId: "reel-1" })));

  expect(system).toContain("지목한 게시물 상세");
  expect(system).toContain("id=reel-1");
});

test("모르는 릴스 id는 무시하고 계정 질문으로 답한다", async () => {
  let system = "";
  chatModel = {
    async *stream(request: { system: string }) {
      system = request.system;
      yield "답변";
    },
  };

  await readEvents(await POST(post({ message: "요즘 어때?", reelId: "없는-릴스" })));

  expect(system).not.toContain("지목한 게시물 상세");
});

test("GET은 저장된 대화와 사용 가능 여부를 준다", async () => {
  chatModel = modelYielding("답변");
  await readEvents(await POST(post({ message: "안녕" })));

  const body = await (await GET()).json();
  expect(body.available).toBe(true);
  expect(body.messages).toHaveLength(2);
});

test("GET은 대화 목록과 활성 대화 id도 함께 준다", async () => {
  const id = await askIn("안녕");

  const body = await (await GET()).json();
  expect(body.activeId).toBe(id);
  expect(body.conversations).toHaveLength(1);
  expect(body.conversations[0].title).toBe("안녕");
});

describe("대화 목록 API", () => {
  test("새 대화를 만들면 활성이 바뀌고 이전 대화는 목록에 남는다", async () => {
    const first = await askIn("첫 질문");

    const created = await (await createConversation(conversationRequest("POST"))).json();

    expect(created.activeId).not.toBe(first);
    expect(created.conversations.map((c: { title: string }) => c.title)).toContain("첫 질문");
    expect(await getChatStore().get()).toEqual([]);
  });

  test("목록은 최근 대화부터 준다", async () => {
    await askIn("먼저 한 질문");
    await createConversation(conversationRequest("POST"));
    await askIn("나중에 한 질문");

    const body = await (await listConversations()).json();
    expect(body.conversations.map((c: { title: string }) => c.title)).toEqual([
      "나중에 한 질문",
      "먼저 한 질문",
    ]);
  });

  test("이전 대화를 열면 그 대화의 메시지를 돌려주고 활성이 된다", async () => {
    const older = await askIn("예전 질문");
    await createConversation(conversationRequest("POST"));
    await askIn("지금 질문");

    const res = await openConversation(conversationRequest("GET", `/${older}`), params(older));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual([
      "예전 질문",
      "답변",
    ]);
    expect(await getChatStore().activeId()).toBe(older);
  });

  test("없는 대화를 열면 404다", async () => {
    const res = await openConversation(conversationRequest("GET", "/없는-id"), params("없는-id"));
    expect(res.status).toBe(404);
  });

  test("대화를 지우면 목록에서 빠지고 남은 대화가 활성이 된다", async () => {
    const survivor = await askIn("남길 질문");
    await createConversation(conversationRequest("POST"));
    const target = await askIn("지울 질문");

    const body = await (
      await deleteConversation(conversationRequest("DELETE", `/${target}`), params(target))
    ).json();

    expect(body.conversations.map((c: { title: string }) => c.title)).toEqual(["남길 질문"]);
    expect(body.activeId).toBe(survivor);
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual(["남길 질문", "답변"]);
  });

  test("다른 출처에서 온 대화 조작은 403으로 거절한다", async () => {
    const res = await createConversation(
      new Request("http://localhost:3000/api/chat/conversations", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          "Content-Type": "application/json",
          origin: "https://evil.test",
        },
      }),
    );
    expect(res.status).toBe(403);
  });

  test("로컬 실행이 아니면 대화 목록도 노출하지 않는다", async () => {
    localRuntime = false;

    expect((await listConversations()).status).toBe(404);
    expect((await createConversation(conversationRequest("POST"))).status).toBe(404);
    expect(
      (await openConversation(conversationRequest("GET", "/x"), params("x"))).status,
    ).toBe(404);
  });
});

test("모델이 실패하면 error 이벤트로 알리고 답변을 저장하지 않는다", async () => {
  chatModel = {
    // eslint-disable-next-line require-yield
    async *stream() {
      throw new Error("API 키가 잘못되었습니다");
    },
  };

  const events = await readEvents(await POST(post({ message: "안녕" })));

  expect(events.at(-1)!.type).toBe("error");
  expect(String(events.at(-1)!.error)).toContain("API 키가 잘못되었습니다");
  // 실패한 턴의 사용자 메시지만 남고 빈 답변이 저장되면 안 된다.
  expect((await getChatStore().get()).every((m) => m.role === "user")).toBe(true);
});

test("제공자 설정이 없으면 사용 불가로 알린다", async () => {
  resolveError = new Error("Anthropic (Claude) API 키가 설정되지 않았습니다.");

  const body = await (await GET()).json();
  expect(body.available).toBe(false);
  expect(String(body.reason)).toContain("API 키");
});

test("빈 메시지는 400으로 거절한다", async () => {
  expect((await POST(post({ message: "   " }))).status).toBe(400);
});

test("JSON이 아닌 본문은 415로 거절한다", async () => {
  const res = await POST(
    new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { host: "localhost:3000", "Content-Type": "text/plain" },
      body: "message=hi",
    }),
  );
  expect(res.status).toBe(415);
});

test("다른 출처에서 온 요청은 403으로 거절한다", async () => {
  expect((await POST(post({ message: "안녕" }, { origin: "https://evil.test" }))).status).toBe(403);
});

test("로컬 실행이 아니면 챗봇을 노출하지 않는다", async () => {
  localRuntime = false;

  expect((await GET()).status).toBe(404);
  expect((await POST(post({ message: "안녕" }))).status).toBe(404);
});

test("GET은 패널 드롭다운에 채울 제공자 선택지를 함께 준다", async () => {
  const body = await (await GET()).json();

  expect(body.modelName).toBe("claude-opus-4-8");
  expect(body.options.map((o: { id: string }) => o.id)).toEqual([
    "claude-cli",
    "codex-cli",
    "anthropic",
    "openai",
    "kimi",
    "gemini",
  ]);
});

test("GET의 선택지는 설치되지 않은 CLI를 고를 수 없다고 표시한다", async () => {
  const body = await (await GET()).json();
  const byId = (id: string) => body.options.find((o: { id: string }) => o.id === id);

  expect(byId("claude-cli").ready).toBe(true);
  expect(byId("codex-cli").ready).toBe(false);
  expect(byId("codex-cli").hint).toContain("codex");
});

test("제공자를 못 쓰는 상태에서도 선택지는 내려준다", async () => {
  // 선택지가 없으면 사용자가 화면에서 쓸 수 있는 제공자로 갈아탈 방법이 없다.
  resolveError = new Error("API 키가 설정되지 않았습니다");

  const body = await (await GET()).json();

  expect(body.available).toBe(false);
  expect(body.options.length).toBeGreaterThan(0);
});

test("제공자를 못 쓰는 상태에서도 지금 골라진 제공자를 알려 준다", async () => {
  resolveError = new Error("API 키가 설정되지 않았습니다");

  const body = await (await GET()).json();

  // 드롭다운이 무엇이 골라져 있는지 못 그리면 사용자는 빈 칸을 보게 된다.
  expect(body.provider).toBe("anthropic");
});
