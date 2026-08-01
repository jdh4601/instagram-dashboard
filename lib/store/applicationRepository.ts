import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ApplicationSchema, type Application } from "@/lib/schemas";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

export interface ApplicationRepository {
  /** 제출 시각 오름차순. */
  list(): Promise<Application[]>;
  /** responseId 기준 upsert. 반영한 건수를 돌려준다. */
  upsertMany(applications: Application[]): Promise<number>;
}

export function sortBySubmittedAt(applications: Application[]): Application[] {
  return [...applications].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export function createJsonApplicationRepository(dataDir: string): ApplicationRepository {
  const file = join(dataDir, "applications.json");

  async function readAll(): Promise<Application[]> {
    if (!existsSync(file)) return [];
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return [];
    return z.array(ApplicationSchema).parse(JSON.parse(raw));
  }

  return {
    async list() {
      return sortBySubmittedAt(await readAll());
    },
    upsertMany: (applications) =>
      withFileLock(file, async () => {
        // parse가 스키마 밖 필드를 떨어뜨린다. 매핑이 뚫려도 신청자 개인정보가
        // 디스크까지 가지 않는 마지막 방어선이다.
        const validated = applications.map((a) => ApplicationSchema.parse(a));
        const byId = new Map((await readAll()).map((a) => [a.responseId, a]));
        for (const application of validated) byId.set(application.responseId, application);
        await writeJsonAtomic(file, sortBySubmittedAt([...byId.values()]));
        return validated.length;
      }),
  };
}
