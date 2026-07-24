import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { AccountProfileSchema, type AccountProfile } from "@/lib/schemas";
import { withFileLock, writeJsonAtomic } from "@/lib/store/jsonFile";

export interface ProfileRepository {
  get(): Promise<AccountProfile | null>;
  save(profile: AccountProfile): Promise<AccountProfile>;
}

export function createJsonProfileRepository(dataDir: string): ProfileRepository {
  const file = join(dataDir, "profile.json");

  return {
    async get() {
      if (!existsSync(file)) return null;
      const raw = await readFile(file, "utf8");
      if (!raw.trim()) return null;
      return AccountProfileSchema.parse(JSON.parse(raw));
    },
    save: (profile) =>
      withFileLock(file, async () => {
        const validated = AccountProfileSchema.parse(profile);
        await writeJsonAtomic(file, validated);
        return validated;
      }),
  };
}
