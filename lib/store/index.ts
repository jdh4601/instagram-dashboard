import { createJsonReelRepository, type ReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository, type AccountRepository } from "@/lib/store/accountRepository";
import { createJsonProfileRepository, type ProfileRepository } from "@/lib/store/profileRepository";
import { createJsonReelHistoryRepository, type ReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import { createJsonApplicationRepository, type ApplicationRepository } from "@/lib/store/applicationRepository";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { createSqliteRepositories } from "@/lib/store/sqliteRepositories";
import { createPostgresRepositories } from "@/lib/store/postgresRepositories";
import type { WorkspaceRepositories } from "@/lib/store/workspace";

let workspace: WorkspaceRepositories | null = null;

function getWorkspace(): WorkspaceRepositories {
  if (workspace) return workspace;
  const config = resolveRuntimeConfig();
  if (config.storageAdapter === "postgres") {
    if (!config.postgresDatabaseUrl) {
      throw new Error("DATABASE_URL is required when STORAGE_ADAPTER=postgres.");
    }
    workspace = createPostgresRepositories(config.postgresDatabaseUrl);
  } else if (config.storageAdapter === "sqlite") {
    workspace = createSqliteRepositories(config.sqliteDatabasePath);
  } else {
    workspace = {
          reels: createJsonReelRepository(config.dataDir),
          accounts: createJsonAccountRepository(config.dataDir),
          profile: createJsonProfileRepository(config.dataDir),
          reelHistory: createJsonReelHistoryRepository(config.dataDir),
          applications: createJsonApplicationRepository(config.dataDir),
    };
  }
  return workspace;
}

export function getRepository(): ReelRepository {
  return getWorkspace().reels;
}

export function getAccountRepository(): AccountRepository {
  return getWorkspace().accounts;
}

export function getProfileRepository(): ProfileRepository {
  return getWorkspace().profile;
}

export function getReelHistoryRepository(): ReelHistoryRepository {
  return getWorkspace().reelHistory;
}

export function getApplicationRepository(): ApplicationRepository {
  return getWorkspace().applications;
}
