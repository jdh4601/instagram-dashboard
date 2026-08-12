import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { HookSchema, type Hook } from "@/lib/schemas";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

export interface HookRepository {
  /** 생성 시각 오름차순. 화면에서 보이는 순서는 lib/ui/hookSelect가 다시 정한다. */
  list(): Promise<Hook[]>;
  get(id: string): Promise<Hook | null>;
  upsert(hook: Hook): Promise<Hook>;
  /** 지운 게 있으면 true. 없는 훅을 지우는 요청은 404로 갈라야 해서 개수가 아닌 여부를 준다. */
  remove(id: string): Promise<boolean>;
}

function sortByCreatedAt(hooks: Hook[]): Hook[] {
  // 같은 시각에 담긴 훅이 어댑터마다 다른 순서로 나오지 않도록 id로 한 번 더 가른다.
  return [...hooks].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export function createJsonHookRepository(dataDir: string): HookRepository {
  const file = join(dataDir, "hooks.json");

  async function readAll(): Promise<Hook[]> {
    if (!existsSync(file)) return [];
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return [];
    return z.array(HookSchema).parse(JSON.parse(raw));
  }

  return {
    async list() {
      return sortByCreatedAt(await readAll());
    },
    async get(id) {
      return (await readAll()).find((h) => h.id === id) ?? null;
    },
    upsert: (hook) =>
      withFileLock(file, async () => {
        // parse가 스키마 밖 필드를 떨어뜨린다. 폼이 뚫려도 검증되지 않은 값이
        // 디스크까지 가지 않는 마지막 방어선이다.
        const validated = HookSchema.parse(hook);
        const byId = new Map((await readAll()).map((h) => [h.id, h]));
        byId.set(validated.id, validated);
        await writeJsonAtomic(file, sortByCreatedAt([...byId.values()]));
        return validated;
      }),
    remove: (id) =>
      withFileLock(file, async () => {
        const all = await readAll();
        const next = all.filter((h) => h.id !== id);
        if (next.length === all.length) return false;
        await writeJsonAtomic(file, next);
        return true;
      }),
  };
}
