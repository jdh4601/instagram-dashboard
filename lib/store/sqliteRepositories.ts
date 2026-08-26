import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import {
  AccountProfileSchema,
  AccountSnapshotSchema,
  ApplicationSchema,
  HookSchema,
  ReelMetricSnapshotSchema,
  ReelSchema,
  SavedStoryFormatSchema,
  type Application,
} from "@/lib/schemas";
import type { WorkspaceRepositories } from "@/lib/store/workspace";

interface PayloadRow {
  payload: string;
}

interface VersionRow {
  user_version: number;
}

function hardenDatabaseFiles(databasePath: string): void {
  if (process.platform === "win32") return;
  for (const path of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    // 런타임 데이터 파일 경로다 — 번들에 포함할 모듈이 아니다. 표시하지 않으면
    // Turbopack이 동적 경로를 보고 프로젝트 전체를 standalone 산출물에 끌어넣는다.
    if (existsSync(/* turbopackIgnore: true */ path)) chmodSync(path, 0o600);
  }
}

function payloadRows<T>(
  statement: StatementSync,
  parse: (value: unknown) => T,
  ...params: Array<string | number>
): T[] {
  return (statement.all(...params) as unknown as PayloadRow[]).map((row) =>
    parse(JSON.parse(row.payload)),
  );
}

function payloadRow<T>(
  statement: StatementSync,
  parse: (value: unknown) => T,
  ...params: Array<string | number>
): T | null {
  const row = statement.get(...params) as unknown as PayloadRow | undefined;
  return row ? parse(JSON.parse(row.payload)) : null;
}

function inTransaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createSqliteRepositories(databasePath: string): WorkspaceRepositories {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  const version = db.prepare("PRAGMA user_version").get() as unknown as VersionRow;
  if (version.user_version > 1) {
    db.close();
    throw new Error(
      `SQLite schema version ${version.user_version} is newer than this app supports (1).`,
    );
  }
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS workspace_records (
      namespace TEXT NOT NULL,
      record_key TEXT NOT NULL,
      owner_key TEXT,
      sort_key TEXT NOT NULL,
      payload TEXT NOT NULL CHECK(json_valid(payload)),
      PRIMARY KEY (namespace, record_key)
    );

    CREATE INDEX IF NOT EXISTS workspace_records_owner
      ON workspace_records(namespace, owner_key, sort_key);
    CREATE INDEX IF NOT EXISTS workspace_records_sort
      ON workspace_records(namespace, sort_key);
    PRAGMA user_version = 1;
  `);
  hardenDatabaseFiles(databasePath);

  const listByNamespace = db.prepare(
    "SELECT payload FROM workspace_records WHERE namespace = ? ORDER BY sort_key, rowid",
  );
  const listByOwner = db.prepare(
    "SELECT payload FROM workspace_records WHERE namespace = ? AND owner_key = ? ORDER BY sort_key, rowid",
  );
  const getByKey = db.prepare(
    "SELECT payload FROM workspace_records WHERE namespace = ? AND record_key = ?",
  );
  const upsert = db.prepare(`
    INSERT INTO workspace_records(namespace, record_key, owner_key, sort_key, payload)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(namespace, record_key) DO UPDATE SET
      owner_key = excluded.owner_key,
      sort_key = excluded.sort_key,
      payload = excluded.payload
  `);
  const removeByKey = db.prepare(
    "DELETE FROM workspace_records WHERE namespace = ? AND record_key = ?",
  );
  const removeByOwner = db.prepare(
    "DELETE FROM workspace_records WHERE namespace = ? AND owner_key = ?",
  );

  const reels: WorkspaceRepositories["reels"] = {
    async list() {
      return payloadRows(listByNamespace, (value) => ReelSchema.parse(value), "reel");
    },
    async get(id) {
      return payloadRow(getByKey, (value) => ReelSchema.parse(value), "reel", id);
    },
    async upsert(reel) {
      const validated = ReelSchema.parse(reel);
      inTransaction(db, () => {
        upsert.run("reel", validated.id, null, validated.postedAt, JSON.stringify(validated));
      });
      return validated;
    },
    async removeMany(ids) {
      if (ids.length === 0) return 0;
      return inTransaction(db, () =>
        ids.reduce((removed, id) => {
          const result = removeByKey.run("reel", id);
          return removed + Number(result.changes);
        }, 0),
      );
    },
  };

  const accounts: WorkspaceRepositories["accounts"] = {
    async list() {
      return payloadRows(
        listByNamespace,
        (value) => AccountSnapshotSchema.parse(value),
        "account-snapshot",
      );
    },
    async add(snapshot) {
      const validated = AccountSnapshotSchema.parse(snapshot);
      inTransaction(db, () => {
        upsert.run(
          "account-snapshot",
          validated.date,
          null,
          validated.date,
          JSON.stringify(validated),
        );
      });
      return validated;
    },
  };

  const profile: WorkspaceRepositories["profile"] = {
    async get() {
      return payloadRow(
        getByKey,
        (value) => AccountProfileSchema.parse(value),
        "profile",
        "current",
      );
    },
    async save(value) {
      const validated = AccountProfileSchema.parse(value);
      inTransaction(db, () => {
        upsert.run("profile", "current", null, validated.updatedAt, JSON.stringify(validated));
      });
      return validated;
    },
  };

  const reelHistory: WorkspaceRepositories["reelHistory"] = {
    async list(reelId) {
      return payloadRows(
        listByOwner,
        (value) => ReelMetricSnapshotSchema.parse(value),
        "reel-history",
        reelId,
      );
    },
    async listAll() {
      return payloadRows(
        listByNamespace,
        (value) => ReelMetricSnapshotSchema.parse(value),
        "reel-history",
      );
    },
    async add(snapshot) {
      const validated = ReelMetricSnapshotSchema.parse(snapshot);
      inTransaction(db, () => {
        upsert.run(
          "reel-history",
          `${validated.reelId}\u001f${validated.date}`,
          validated.reelId,
          validated.date,
          JSON.stringify(validated),
        );
      });
      return validated;
    },
    async removeByReelIds(reelIds) {
      if (reelIds.length === 0) return 0;
      return inTransaction(db, () =>
        reelIds.reduce((removed, reelId) => {
          const result = removeByOwner.run("reel-history", reelId);
          return removed + Number(result.changes);
        }, 0),
      );
    },
  };

  // 신청은 responseId가 유일 키, submittedAt이 정렬 키다. 테이블이 네임스페이스로
  // 나뉜 범용 구조라 스키마 변경 없이 새 네임스페이스만 쓴다.
  const applications: WorkspaceRepositories["applications"] = {
    async list() {
      return payloadRows(
        listByNamespace,
        (value) => ApplicationSchema.parse(value),
        "application",
      );
    },
    async upsertMany(incoming: Application[]) {
      const validated = incoming.map((application) => ApplicationSchema.parse(application));
      if (validated.length === 0) return 0;
      inTransaction(db, () => {
        for (const application of validated) {
          upsert.run(
            "application",
            application.responseId,
            null,
            application.submittedAt,
            JSON.stringify(application),
          );
        }
      });
      return validated.length;
    },
  };

  // 훅은 id가 유일 키, createdAt이 정렬 키다. 범용 네임스페이스 테이블이라
  // 마이그레이션 없이 새 네임스페이스만 얹는다.
  const hooks: WorkspaceRepositories["hooks"] = {
    async list() {
      return payloadRows(listByNamespace, (value) => HookSchema.parse(value), "hook");
    },
    async get(id) {
      return payloadRow(getByKey, (value) => HookSchema.parse(value), "hook", id);
    },
    async upsert(hook) {
      const validated = HookSchema.parse(hook);
      inTransaction(db, () => {
        upsert.run("hook", validated.id, null, validated.createdAt, JSON.stringify(validated));
      });
      return validated;
    },
    async remove(id) {
      return inTransaction(db, () => Number(removeByKey.run("hook", id).changes) > 0);
    },
  };

  // 저장한 스토리텔링 포맷도 훅과 같은 모양이다 — id가 유일 키(릴스 id), createdAt이 정렬 키.
  const storyFormats: WorkspaceRepositories["storyFormats"] = {
    async list() {
      return payloadRows(
        listByNamespace,
        (value) => SavedStoryFormatSchema.parse(value),
        "story-format",
      );
    },
    async get(id) {
      return payloadRow(
        getByKey,
        (value) => SavedStoryFormatSchema.parse(value),
        "story-format",
        id,
      );
    },
    async upsert(saved) {
      const validated = SavedStoryFormatSchema.parse(saved);
      inTransaction(db, () => {
        upsert.run(
          "story-format",
          validated.id,
          null,
          validated.createdAt,
          JSON.stringify(validated),
        );
      });
      return validated;
    },
    async remove(id) {
      return inTransaction(db, () => Number(removeByKey.run("story-format", id).changes) > 0);
    },
  };

  return {
    reels,
    accounts,
    profile,
    reelHistory,
    applications,
    hooks,
    storyFormats,
    close: () => {
      hardenDatabaseFiles(databasePath);
      db.close();
      hardenDatabaseFiles(databasePath);
    },
  };
}
