import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository } from "@/lib/store/accountRepository";
import { createJsonReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import { createSettingsStore } from "@/lib/settings/store";
import type { Reel } from "@/lib/schemas";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "store-mutex-"));
}

function reelWith(id: string, views: number): Reel {
  return {
    id, postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
    views, reach: 9000, likes: 300, comments: 12,
    saves: 40, shares: 170, avgWatchTimeSec: 20,
  };
}

test("two concurrent upserts on the same repo both persist (no lost update)", async () => {
  const repo = createJsonReelRepository(tmpDir());
  await Promise.all([repo.upsert(reelWith("a", 100)), repo.upsert(reelWith("b", 200))]);

  const all = await repo.list();
  expect(all.map((r) => r.id).sort()).toEqual(["a", "b"]);
});

test("many concurrent upserts all persist", async () => {
  const repo = createJsonReelRepository(tmpDir());
  const ids = Array.from({ length: 20 }, (_, i) => `r${i}`);
  await Promise.all(ids.map((id, i) => repo.upsert(reelWith(id, i * 100))));

  const all = await repo.list();
  expect(all).toHaveLength(20);
  expect(new Set(all.map((r) => r.id))).toEqual(new Set(ids));
});

test("two repository instances targeting the same file do not lose concurrent upserts", async () => {
  const dir = tmpDir();
  const first = createJsonReelRepository(dir);
  const second = createJsonReelRepository(dir);

  await Promise.all([
    first.upsert(reelWith("from-first", 100)),
    second.upsert(reelWith("from-second", 200)),
  ]);

  expect((await first.list()).map((r) => r.id).sort()).toEqual(["from-first", "from-second"]);
});

test("concurrent settings saves preserve independent provider updates", async () => {
  const dir = tmpDir();
  const first = createSettingsStore(dir);
  const second = createSettingsStore(dir);

  await Promise.all([
    first.save({ providers: { anthropic: { apiKey: "sk-ant-concurrent-1111" } } }),
    second.save({ providers: { openai: { apiKey: "sk-openai-concurrent-2222" } } }),
  ]);

  const saved = await first.get();
  expect(saved.providers.anthropic.apiKey).toBe("sk-ant-concurrent-1111");
  expect(saved.providers.openai.apiKey).toBe("sk-openai-concurrent-2222");
});

test("concurrent adds on account repo both persist", async () => {
  const repo = createJsonAccountRepository(tmpDir());
  await Promise.all([
    repo.add({ date: "2026-06-01", followerCount: 1000, reachLast7d: 4000 }),
    repo.add({ date: "2026-06-02", followerCount: 1010, reachLast7d: 4100 }),
  ]);

  const all = await repo.list();
  expect(all.map((s) => s.date)).toEqual(["2026-06-01", "2026-06-02"]);
});

test("concurrent adds on reel history repo both persist", async () => {
  const repo = createJsonReelHistoryRepository(tmpDir());
  await Promise.all([
    repo.add({ reelId: "a", date: "2026-06-01", views: 1, reach: 1, likes: 0, comments: 0, saves: 0, shares: 0 }),
    repo.add({ reelId: "a", date: "2026-06-02", views: 2, reach: 2, likes: 0, comments: 0, saves: 0, shares: 0 }),
  ]);

  expect(await repo.list("a")).toHaveLength(2);
});

test("a rejected operation does not poison the mutex chain", async () => {
  const repo = createJsonReelRepository(tmpDir());

  // Invalid payload rejects inside the locked section.
  await expect(
    repo.upsert({ ...reelWith("bad", 1), views: "not-a-number" } as unknown as Reel),
  ).rejects.toThrow();

  // Later operations on the same file must still run.
  await repo.upsert(reelWith("good", 500));
  expect(await repo.list()).toHaveLength(1);
  expect((await repo.get("good"))?.views).toBe(500);
});

test("same-date overwrite semantics still hold under concurrency", async () => {
  const repo = createJsonAccountRepository(tmpDir());
  await Promise.all([
    repo.add({ date: "2026-06-01", followerCount: 1000, reachLast7d: 4000 }),
    repo.add({ date: "2026-06-01", followerCount: 1050, reachLast7d: 4200 }),
  ]);

  const all = await repo.list();
  expect(all).toHaveLength(1);
  expect([1000, 1050]).toContain(all[0].followerCount);
});
