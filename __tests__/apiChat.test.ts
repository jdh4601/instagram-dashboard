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
    return { provider: "anthropic", label: "Anthropic (Claude)", model: chatModel };
  },
  chatProviderLabel: () => "Anthropic (Claude)",
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

import { GET, POST, DELETE } from "@/app/api/chat/route";
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

beforeEach(async () => {
  localRuntime = true;
  resolveError = null;
  await getChatStore().clear();
});

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

test("GET은 저장된 대화와 사용 가능 여부를 준다", async () => {
  chatModel = modelYielding("답변");
  await readEvents(await POST(post({ message: "안녕" })));

  const body = await (await GET()).json();
  expect(body.available).toBe(true);
  expect(body.messages).toHaveLength(2);
});

test("DELETE는 대화를 비운다", async () => {
  chatModel = modelYielding("답변");
  await readEvents(await POST(post({ message: "안녕" })));

  const res = await DELETE(
    new Request("http://localhost:3000/api/chat", {
      method: "DELETE",
      headers: { host: "localhost:3000", "Content-Type": "application/json" },
    }),
  );

  expect(res.status).toBe(200);
  expect(await getChatStore().get()).toEqual([]);
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
