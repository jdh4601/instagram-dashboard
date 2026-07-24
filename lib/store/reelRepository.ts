import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ReelSchema, type Reel } from "@/lib/schemas";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

export interface ReelRepository {
  list(): Promise<Reel[]>;
  get(id: string): Promise<Reel | null>;
  upsert(reel: Reel): Promise<Reel>;
  removeMany(ids: string[]): Promise<number>;
}

export function createJsonReelRepository(dataDir: string): ReelRepository {
  const file = join(dataDir, "reels.json");

  async function readAll(): Promise<Reel[]> {
    if (!existsSync(file)) return [];
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return [];
    return z.array(ReelSchema).parse(JSON.parse(raw));
  }

  return {
    list: () => readAll(),
    async get(id) {
      const all = await readAll();
      return all.find((r) => r.id === id) ?? null;
    },
    upsert: (reel) =>
      withFileLock(file, async () => {
        const validated = ReelSchema.parse(reel);
        const all = await readAll();
        const idx = all.findIndex((r) => r.id === validated.id);
        const next = idx === -1 ? [...all, validated] : all.map((r, i) => (i === idx ? validated : r));
        await writeJsonAtomic(file, next);
        return validated;
      }),
    removeMany: (ids) =>
      withFileLock(file, async () => {
        if (ids.length === 0) return 0;
        const doomed = new Set(ids);
        const all = await readAll();
        const next = all.filter((r) => !doomed.has(r.id));
        const removed = all.length - next.length;
        if (removed > 0) await writeJsonAtomic(file, next);
        return removed;
      }),
  };
}
