import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { SavedStoryFormatSchema, type SavedStoryFormat } from "@/lib/schemas";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

export interface SavedStoryFormatRepository {
  /** 저장 시각 오름차순. 화면이 유형별로 다시 묶는다. */
  list(): Promise<SavedStoryFormat[]>;
  get(id: string): Promise<SavedStoryFormat | null>;
  upsert(saved: SavedStoryFormat): Promise<SavedStoryFormat>;
  /** 지운 게 있으면 true. 없는 항목을 지우는 요청은 404로 갈라야 한다. */
  remove(id: string): Promise<boolean>;
}

function sortByCreatedAt(items: SavedStoryFormat[]): SavedStoryFormat[] {
  // 같은 시각에 담긴 항목이 어댑터마다 다른 순서로 나오지 않도록 id로 한 번 더 가른다.
  return [...items].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export function createJsonSavedStoryFormatRepository(dataDir: string): SavedStoryFormatRepository {
  const file = join(dataDir, "story-formats.json");

  async function readAll(): Promise<SavedStoryFormat[]> {
    if (!existsSync(file)) return [];
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return [];
    return z.array(SavedStoryFormatSchema).parse(JSON.parse(raw));
  }

  return {
    async list() {
      return sortByCreatedAt(await readAll());
    },
    async get(id) {
      return (await readAll()).find((item) => item.id === id) ?? null;
    },
    upsert: (saved) =>
      withFileLock(file, async () => {
        // parse가 스키마 밖 필드를 떨어뜨린다. 검증되지 않은 값이 디스크까지 가지
        // 않는 마지막 방어선이다.
        const validated = SavedStoryFormatSchema.parse(saved);
        const byId = new Map((await readAll()).map((item) => [item.id, item]));
        byId.set(validated.id, validated);
        await writeJsonAtomic(file, sortByCreatedAt([...byId.values()]));
        return validated;
      }),
    remove: (id) =>
      withFileLock(file, async () => {
        const all = await readAll();
        const next = all.filter((item) => item.id !== id);
        if (next.length === all.length) return false;
        await writeJsonAtomic(file, next);
        return true;
      }),
  };
}
