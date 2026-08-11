import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";
import { createJsonHookRepository } from "@/lib/store/hookRepository";
import { HookSchema, type Hook } from "@/lib/schemas";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "hook-repo-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

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

test("파일이 없으면 빈 목록을 준다", async () => {
  const repo = createJsonHookRepository(dir);

  expect(await repo.list()).toEqual([]);
});

test("저장한 훅을 다시 읽는다", async () => {
  const repo = createJsonHookRepository(dir);

  await repo.upsert(hook("h1"));

  expect(await repo.list()).toEqual([hook("h1")]);
  expect(await repo.get("h1")).toEqual(hook("h1"));
});

test("없는 id는 null을 준다", async () => {
  const repo = createJsonHookRepository(dir);

  expect(await repo.get("없는-훅")).toBeNull();
});

test("같은 id는 덮어쓰고 늘리지 않는다", async () => {
  const repo = createJsonHookRepository(dir);

  await repo.upsert(hook("h1", { isFavorite: false }));
  await repo.upsert(hook("h1", { isFavorite: true }));

  const all = await repo.list();
  expect(all).toHaveLength(1);
  expect(all[0].isFavorite).toBe(true);
});

test("생성 시각 오름차순으로 정렬해 준다", async () => {
  const repo = createJsonHookRepository(dir);

  await repo.upsert(hook("late", { createdAt: "2026-08-03T09:00:00.000Z" }));
  await repo.upsert(hook("early", { createdAt: "2026-08-01T09:00:00.000Z" }));

  expect((await repo.list()).map((h) => h.id)).toEqual(["early", "late"]);
});

test("삭제하면 true, 없는 훅을 지우면 false", async () => {
  const repo = createJsonHookRepository(dir);
  await repo.upsert(hook("h1"));

  expect(await repo.remove("h1")).toBe(true);
  expect(await repo.remove("h1")).toBe(false);
  expect(await repo.list()).toEqual([]);
});

test("빈 파일을 빈 목록으로 읽는다", async () => {
  await writeFile(join(dir, "hooks.json"), "  ", "utf8");
  const repo = createJsonHookRepository(dir);

  expect(await repo.list()).toEqual([]);
});

test("스키마 밖 필드는 디스크까지 가지 않는다", async () => {
  const repo = createJsonHookRepository(dir);

  await repo.upsert({ ...hook("h1"), secret: "노출되면 안 되는 값" } as Hook);

  expect(await repo.get("h1")).not.toHaveProperty("secret");
});

test("스크립트 URL은 저장 단계에서 거절한다", () => {
  // 훅 행이 원본 링크를 <a href>로 그대로 걸기 때문에, javascript: 스킴이
  // 저장소까지 들어오면 클릭 한 번이 스크립트 실행이 된다.
  expect(HookSchema.safeParse(hook("h1", { sourceUrl: "javascript:alert(1)" })).success).toBe(
    false,
  );
  expect(
    HookSchema.safeParse(hook("h1", { sourceUrl: "https://instagram.com/reel/abc" })).success,
  ).toBe(true);
});
