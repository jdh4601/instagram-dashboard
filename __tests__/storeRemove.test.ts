import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import type { Reel } from "@/lib/schemas";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "store-remove-"));
}

const reel = (id: string): Reel => ({
  id,
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
  avgWatchTimeSec: 10,
});

const snapshot = (reelId: string, date: string) => ({
  reelId,
  date,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
});

test("removeMany는 지정한 릴스만 지우고 삭제 건수를 돌려준다", async () => {
  const repo = createJsonReelRepository(tmpDir());
  await repo.upsert(reel("r1"));
  await repo.upsert(reel("r2"));
  await repo.upsert(reel("r3"));

  const removed = await repo.removeMany(["r1", "r3"]);

  expect(removed).toBe(2);
  expect((await repo.list()).map((r) => r.id)).toEqual(["r2"]);
});

test("removeMany는 없는 id와 빈 배열에서 아무것도 지우지 않는다", async () => {
  const repo = createJsonReelRepository(tmpDir());
  await repo.upsert(reel("r1"));

  expect(await repo.removeMany(["없는-id"])).toBe(0);
  expect(await repo.removeMany([])).toBe(0);
  expect(await repo.list()).toHaveLength(1);
});

test("removeByReelIds는 해당 릴스의 이력만 지운다", async () => {
  const repo = createJsonReelHistoryRepository(tmpDir());
  await repo.add(snapshot("r1", "2026-06-01"));
  await repo.add(snapshot("r1", "2026-06-02"));
  await repo.add(snapshot("r2", "2026-06-01"));

  const removed = await repo.removeByReelIds(["r1"]);

  expect(removed).toBe(2);
  expect(await repo.list("r1")).toHaveLength(0);
  expect(await repo.list("r2")).toHaveLength(1);
});

test("removeByReelIds는 빈 배열에서 아무것도 지우지 않는다", async () => {
  const repo = createJsonReelHistoryRepository(tmpDir());
  await repo.add(snapshot("r1", "2026-06-01"));

  expect(await repo.removeByReelIds([])).toBe(0);
  expect(await repo.list("r1")).toHaveLength(1);
});
