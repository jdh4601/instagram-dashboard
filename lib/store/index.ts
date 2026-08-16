import { createJsonReelRepository, type ReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository, type AccountRepository } from "@/lib/store/accountRepository";
import { createJsonProfileRepository, type ProfileRepository } from "@/lib/store/profileRepository";
import { createJsonReelHistoryRepository, type ReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import { createJsonApplicationRepository, type ApplicationRepository } from "@/lib/store/applicationRepository";
import { createJsonHookRepository, type HookRepository } from "@/lib/store/hookRepository";
import { createJsonAdSpendRepository, type AdSpendRepository } from "@/lib/store/adSpendRepository";
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
          hooks: createJsonHookRepository(config.dataDir),
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

export function getHookRepository(): HookRepository {
  return getWorkspace().hooks;
}

/**
 * 수동으로 옮겨 적은 광고 지출. 저장소 어댑터(sqlite·postgres)를 타지 않고 언제나
 * JSON 파일이다 — 손으로 관리하는 수십 줄짜리 기록이라 스키마를 세 벌 늘릴 값어치가
 * 없고, 사람이 직접 열어 고칠 수 있는 편이 낫다.
 */
export function getAdSpendRepository(): AdSpendRepository {
  return createJsonAdSpendRepository(resolveRuntimeConfig().dataDir);
}
