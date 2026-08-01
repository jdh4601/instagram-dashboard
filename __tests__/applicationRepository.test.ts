import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";
import { createJsonApplicationRepository } from "@/lib/store/applicationRepository";
import type { Application } from "@/lib/schemas";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "walla-repo-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function application(responseId: string, overrides: Partial<Application> = {}): Application {
  return {
    responseId,
    submittedAt: "2026-07-30T14:30:00Z",
    source: "instagram",
    medium: "bio",
    ...overrides,
  };
}

test("파일이 없으면 빈 목록을 준다", async () => {
  const repo = createJsonApplicationRepository(dir);

  expect(await repo.list()).toEqual([]);
});

test("저장한 신청을 다시 읽는다", async () => {
  const repo = createJsonApplicationRepository(dir);

  await repo.upsertMany([application("r1")]);

  expect(await repo.list()).toEqual([application("r1")]);
});

test("같은 responseId는 덮어쓰고 늘리지 않는다", async () => {
  const repo = createJsonApplicationRepository(dir);

  await repo.upsertMany([application("r1", { medium: "bio" })]);
  await repo.upsertMany([application("r1", { medium: "paid" })]);

  const all = await repo.list();
  expect(all).toHaveLength(1);
  expect(all[0].medium).toBe("paid");
});

test("제출 시각 오름차순으로 정렬해 준다", async () => {
  const repo = createJsonApplicationRepository(dir);

  await repo.upsertMany([
    application("late", { submittedAt: "2026-07-31T09:00:00Z" }),
    application("early", { submittedAt: "2026-07-29T09:00:00Z" }),
  ]);

  expect((await repo.list()).map((a) => a.responseId)).toEqual(["early", "late"]);
});

test("반영한 건수를 돌려준다", async () => {
  const repo = createJsonApplicationRepository(dir);

  expect(await repo.upsertMany([application("r1"), application("r2")])).toBe(2);
});

test("빈 파일을 빈 목록으로 읽는다", async () => {
  await writeFile(join(dir, "applications.json"), "  ", "utf8");
  const repo = createJsonApplicationRepository(dir);

  expect(await repo.list()).toEqual([]);
});

test("신청자 개인정보가 섞여 들어와도 저장하지 않는다", async () => {
  // 스키마가 마지막 방어선이다. 매핑이 뚫려도 파일에는 UTM만 남아야 한다.
  const repo = createJsonApplicationRepository(dir);

  await repo.upsertMany([
    { ...application("r1"), name: "홍길동", phone: "010-0000-0000" } as Application,
  ]);

  const raw = await readFile(join(dir, "applications.json"), "utf8");
  expect(raw).not.toContain("홍길동");
  expect(raw).not.toContain("010-0000-0000");
});
