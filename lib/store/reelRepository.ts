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
  };
}
