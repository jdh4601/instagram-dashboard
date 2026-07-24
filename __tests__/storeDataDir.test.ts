import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Reel } from "@/lib/schemas";

const reel: Reel = {
  id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
  views: 10000, reach: 9000, likes: 300, comments: 12,
  saves: 40, shares: 170, avgWatchTimeSec: 20,
};

describe("DATA_DIR override", () => {
  const original = process.env.DATA_DIR;

  afterEach(() => {
    if (original === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = original;
    jest.resetModules();
  });

  test("getRepository() writes under DATA_DIR when the env var is set", async () => {
    const dir = mkdtempSync(join(tmpdir(), "store-datadir-"));
    process.env.DATA_DIR = dir;
    jest.resetModules();

    // Repos are cached singletons, so re-import after setting the env var.
    const store = await import("@/lib/store");
    await store.getRepository().upsert(reel);

    const target = join(dir, "reels.json");
    expect(existsSync(target)).toBe(true);
    const parsed = JSON.parse(readFileSync(target, "utf8"));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("r1");
  });

  test("all repositories honor DATA_DIR", async () => {
    const dir = mkdtempSync(join(tmpdir(), "store-datadir-all-"));
    process.env.DATA_DIR = dir;
    jest.resetModules();

    const store = await import("@/lib/store");
    await store.getAccountRepository().add({ date: "2026-06-01", followerCount: 1000, reachLast7d: 4000 });
    await store.getProfileRepository().save({
      username: "founder", avatarUrl: "https://cdn/a.jpg",
      followersCount: 238, mediaCount: 12, updatedAt: "2026-06-29",
    });
    await store.getReelHistoryRepository().add({
      reelId: "r1", date: "2026-06-01",
      views: 1, reach: 1, likes: 0, comments: 0, saves: 0, shares: 0,
    });

    expect(existsSync(join(dir, "snapshots.json"))).toBe(true);
    expect(existsSync(join(dir, "profile.json"))).toBe(true);
    expect(existsSync(join(dir, "reel-history.json"))).toBe(true);
  });
});
