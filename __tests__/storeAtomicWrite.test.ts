import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonProfileRepository } from "@/lib/store/profileRepository";
import type { Reel } from "@/lib/schemas";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "store-atomic-"));
}

const reel: Reel = {
  id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
  views: 10000, reach: 9000, likes: 300, comments: 12,
  saves: 40, shares: 170, avgWatchTimeSec: 20,
};

test("upsert writes valid JSON and leaves no .tmp file behind", async () => {
  const dir = tmpDir();
  const repo = createJsonReelRepository(dir);
  await repo.upsert(reel);

  const files = readdirSync(dir);
  expect(files).toEqual(["reels.json"]);
  expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);

  const parsed = JSON.parse(readFileSync(join(dir, "reels.json"), "utf8"));
  expect(parsed).toHaveLength(1);
  expect(parsed[0]).toMatchObject({ id: "r1", views: 10000 });
});

test("repeated writes still leave only the target file", async () => {
  const dir = tmpDir();
  const repo = createJsonReelRepository(dir);
  await repo.upsert(reel);
  await repo.upsert({ ...reel, views: 20000 });

  expect(readdirSync(dir)).toEqual(["reels.json"]);
  const parsed = JSON.parse(readFileSync(join(dir, "reels.json"), "utf8"));
  expect(parsed[0].views).toBe(20000);
});

test("save (profile) is atomic too: no .tmp file, valid JSON", async () => {
  const dir = tmpDir();
  const repo = createJsonProfileRepository(dir);
  await repo.save({
    username: "founder",
    avatarUrl: "https://cdn/a.jpg",
    followersCount: 238,
    mediaCount: 12,
    updatedAt: "2026-06-29",
  });

  expect(readdirSync(dir)).toEqual(["profile.json"]);
  const parsed = JSON.parse(readFileSync(join(dir, "profile.json"), "utf8"));
  expect(parsed.username).toBe("founder");
});

test("a leftover .tmp file from a crashed write does not break reads", async () => {
  const dir = tmpDir();
  const repo = createJsonReelRepository(dir);
  await repo.upsert(reel);

  // Simulate debris from an interrupted write next to a good target file.
  writeFileSync(join(dir, "reels.json.tmp"), "{\"truncated\":", "utf8");
  expect(await repo.get("r1")).toMatchObject({ id: "r1" });

  // The next successful write cleans up the debris via rename.
  await repo.upsert({ ...reel, views: 30000 });
  expect(readdirSync(dir)).toEqual(["reels.json"]);
  expect((await repo.get("r1"))?.views).toBe(30000);
});
