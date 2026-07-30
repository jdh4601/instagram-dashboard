import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSqliteRepositories } from "@/lib/store/sqliteRepositories";
import type { Reel } from "@/lib/schemas";

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "instagram-sqlite-"));
  return createSqliteRepositories(join(dir, "workspace.sqlite"));
}

const reel: Reel = {
  id: "r1",
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 100,
  reach: 80,
  likes: 10,
  comments: 2,
  saves: 3,
  shares: 4,
  avgWatchTimeSec: 12,
};

test("SQLite workspace implements reel upsert/get/remove", async () => {
  const dir = mkdtempSync(join(tmpdir(), "instagram-sqlite-mode-"));
  const path = join(dir, "workspace.sqlite");
  const store = createSqliteRepositories(path);
  try {
    await store.reels.upsert(reel);
    await store.reels.upsert({ ...reel, views: 250 });
    expect(await store.reels.get("r1")).toMatchObject({ id: "r1", views: 250 });
    expect(await store.reels.list()).toHaveLength(1);
    expect(await store.reels.removeMany(["r1", "missing"])).toBe(1);
    expect(await store.reels.get("r1")).toBeNull();
    if (process.platform !== "win32") {
      expect(statSync(path).mode & 0o777).toBe(0o600);
    }
  } finally {
    store.close?.();
  }
});

test("SQLite workspace implements account, profile, and reel history contracts", async () => {
  const store = workspace();
  try {
    await store.accounts.add({
      date: "2026-07-02",
      followerCount: 12,
      reachLast7d: 30,
    });
    await store.accounts.add({
      date: "2026-07-01",
      followerCount: 10,
      reachLast7d: 20,
    });
    expect((await store.accounts.list()).map((item) => item.date)).toEqual([
      "2026-07-01",
      "2026-07-02",
    ]);

    await store.profile.save({
      username: "example",
      followersCount: 12,
      mediaCount: 2,
      updatedAt: "2026-07-02T00:00:00Z",
    });
    expect(await store.profile.get()).toMatchObject({ username: "example" });

    const history = {
      reelId: "r1",
      date: "2026-07-01",
      views: 1,
      reach: 1,
      likes: 0,
      comments: 0,
      saves: 0,
      shares: 0,
    };
    await store.reelHistory.add(history);
    await store.reelHistory.add({ ...history, views: 2 });
    expect(await store.reelHistory.list("r1")).toEqual([{ ...history, views: 2 }]);
    expect(await store.reelHistory.removeByReelIds(["r1"])).toBe(1);
    expect(await store.reelHistory.listAll()).toEqual([]);
  } finally {
    store.close?.();
  }
});
