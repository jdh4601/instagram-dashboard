// /api/hooks 라우트 테스트. 저장소는 mock으로 대체한다.
vi.mock("@/lib/store", () => ({ getHookRepository: vi.fn() }));

import { GET, POST } from "@/app/api/hooks/route";
import { DELETE, PATCH } from "@/app/api/hooks/[id]/route";
import { getHookRepository } from "@/lib/store";
import type { Hook } from "@/lib/schemas";
import type { Mock } from "vitest";

const mockGetHookRepository = getHookRepository as unknown as Mock;

function hook(id: string, overrides: Partial<Hook> = {}): Hook {
  return {
    id,
    text: "이걸 모르면 1년을 날립니다",
    category: "problem",
    isFavorite: false,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    ...overrides,
  };
}

let stored: Hook[] = [];

const fakeRepo = {
  list: vi.fn(async () => stored),
  get: vi.fn(async (id: string) => stored.find((h) => h.id === id) ?? null),
  upsert: vi.fn(async (h: Hook) => {
    stored = [...stored.filter((existing) => existing.id !== h.id), h];
    return h;
  }),
  remove: vi.fn(async (id: string) => {
    const before = stored.length;
    stored = stored.filter((h) => h.id !== id);
    return stored.length !== before;
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  stored = [];
  mockGetHookRepository.mockReturnValue(fakeRepo);
});

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost:3000/api/hooks", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

async function create(body: unknown) {
  const res = await POST(jsonRequest("POST", body));
  return { status: res.status, body: await res.json() };
}

async function patch(id: string, body: unknown) {
  const res = await PATCH(jsonRequest("PATCH", body), ctx(id));
  return { status: res.status, body: await res.json() };
}

test("목록은 저장된 훅을 그대로 준다", async () => {
  stored = [hook("h1")];

  const res = await GET();

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ hooks: [hook("h1")] });
});

test("훅을 만들면 id와 시각을 서버가 채운다", async () => {
  const { status, body } = await create({
    text: "3년 걸린 걸 3개월로 줄인 방법",
    category: "experience",
    sourceHandle: "wearedone.kr",
  });

  expect(status).toBe(201);
  expect(body.hook.id).toBeTruthy();
  expect(body.hook.createdAt).toBe(body.hook.updatedAt);
  expect(body.hook.sourceHandle).toBe("wearedone.kr");
  // 즐겨찾기는 나중에 하트로 켜는 것이라 새 훅은 항상 꺼진 상태로 들어간다.
  expect(body.hook.isFavorite).toBe(false);
  expect(fakeRepo.upsert).toHaveBeenCalledTimes(1);
});

test("클라이언트가 보낸 id·시각은 무시한다", async () => {
  const { body } = await create({
    id: "내가-정한-id",
    createdAt: "1999-01-01T00:00:00.000Z",
    text: "훅 문장",
    category: "curiosity",
  });

  expect(body.hook.id).not.toBe("내가-정한-id");
  expect(body.hook.createdAt).not.toBe("1999-01-01T00:00:00.000Z");
});

test("훅 문장이 비면 400과 한국어 메시지를 준다", async () => {
  const { status, body } = await create({ text: "   ", category: "problem" });

  expect(status).toBe(400);
  expect(body.error).toContain("요청 값이 올바르지 않습니다");
});

test("모르는 분류는 400", async () => {
  const { status } = await create({ text: "훅 문장", category: "없는분류" });

  expect(status).toBe(400);
});

test("스크립트 URL은 라우트에서 막는다", async () => {
  const { status } = await create({
    text: "훅 문장",
    category: "problem",
    sourceUrl: "javascript:alert(1)",
  });

  expect(status).toBe(400);
  expect(fakeRepo.upsert).not.toHaveBeenCalled();
});

test("JSON이 아닌 본문은 415로 막는다", async () => {
  const res = await POST(
    new Request("http://localhost:3000/api/hooks", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "text=훅",
    }),
  );

  expect(res.status).toBe(415);
});

test("깨진 JSON은 400", async () => {
  const res = await POST(
    new Request("http://localhost:3000/api/hooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  );

  expect(res.status).toBe(400);
});

test("즐겨찾기 토글은 수정 라우트로 처리한다", async () => {
  stored = [hook("h1")];

  const { status, body } = await patch("h1", { isFavorite: true });

  expect(status).toBe(200);
  expect(body.hook.isFavorite).toBe(true);
  // 생성 시각은 보존하고 수정 시각만 움직인다 — 보관 순서가 하트로 흔들리면 안 된다.
  expect(body.hook.createdAt).toBe("2026-08-01T09:00:00.000Z");
  expect(body.hook.updatedAt).not.toBe("2026-08-01T09:00:00.000Z");
});

test("수정은 보낸 필드만 바꾼다", async () => {
  stored = [hook("h1", { note: "지켜야 할 메모" })];

  const { body } = await patch("h1", { text: "새 훅 문장" });

  expect(body.hook.text).toBe("새 훅 문장");
  expect(body.hook.note).toBe("지켜야 할 메모");
  expect(body.hook.category).toBe("problem");
});

test("빈 수정 요청은 400", async () => {
  stored = [hook("h1")];

  const { status } = await patch("h1", {});

  expect(status).toBe(400);
});

test("없는 훅 수정은 404", async () => {
  const { status } = await patch("없는-훅", { isFavorite: true });

  expect(status).toBe(404);
});

test("훅을 지운다", async () => {
  stored = [hook("h1")];

  const res = await DELETE(jsonRequest("DELETE", {}), ctx("h1"));

  expect(res.status).toBe(200);
  expect(stored).toEqual([]);
});

test("없는 훅 삭제는 404", async () => {
  const res = await DELETE(jsonRequest("DELETE", {}), ctx("없는-훅"));

  expect(res.status).toBe(404);
});
