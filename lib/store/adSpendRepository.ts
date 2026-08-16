import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AdSpendSchema, type AdSpend } from "@/lib/schemas";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

export interface AdSpendRepository {
  /** 부스트 시작일 오름차순. */
  list(): Promise<AdSpend[]>;
  /** mediaId + boostedAt + resultType 기준 upsert. 반영한 건수를 돌려준다. */
  upsertMany(entries: AdSpend[]): Promise<number>;
}

/** 같은 게시물을 같은 날 두 목표로 태울 수 있어 유형까지 키에 넣는다. */
function keyOf(entry: AdSpend): string {
  return `${entry.mediaId}::${entry.boostedAt}::${entry.resultType}`;
}

function sortByBoostedAt(entries: AdSpend[]): AdSpend[] {
  return [...entries].sort((a, b) => a.boostedAt.localeCompare(b.boostedAt));
}

export function createJsonAdSpendRepository(dataDir: string): AdSpendRepository {
  const file = join(dataDir, "ad-spend.json");

  async function readAll(): Promise<AdSpend[]> {
    if (!existsSync(file)) return [];
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return [];
    return z.array(AdSpendSchema).parse(JSON.parse(raw));
  }

  return {
    async list() {
      return sortByBoostedAt(await readAll());
    },
    upsertMany: (entries) =>
      withFileLock(file, async () => {
        const validated = entries.map((entry) => AdSpendSchema.parse(entry));
        const byKey = new Map((await readAll()).map((entry) => [keyOf(entry), entry]));
        for (const entry of validated) byKey.set(keyOf(entry), entry);
        await writeJsonAtomic(file, sortByBoostedAt([...byKey.values()]));
        return validated.length;
      }),
  };
}
