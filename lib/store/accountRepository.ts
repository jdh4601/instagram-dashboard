import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AccountSnapshotSchema, type AccountSnapshot } from "@/lib/schemas";
import { sortByDate } from "@/lib/analysis/followerTrend";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

export interface AccountRepository {
  list(): Promise<AccountSnapshot[]>;
  add(snapshot: AccountSnapshot): Promise<AccountSnapshot>;
}

export function createJsonAccountRepository(dataDir: string): AccountRepository {
  const file = join(dataDir, "snapshots.json");

  async function readAll(): Promise<AccountSnapshot[]> {
    if (!existsSync(file)) return [];
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return [];
    return z.array(AccountSnapshotSchema).parse(JSON.parse(raw));
  }

  return {
    async list() {
      return sortByDate(await readAll());
    },
    add: (snapshot) =>
      withFileLock(file, async () => {
        const validated = AccountSnapshotSchema.parse(snapshot);
        const all = await readAll();
        const idx = all.findIndex((s) => s.date === validated.date);
        const next =
          idx === -1 ? [...all, validated] : all.map((s, i) => (i === idx ? validated : s));
        await writeJsonAtomic(file, next);
        return validated;
      }),
  };
}
