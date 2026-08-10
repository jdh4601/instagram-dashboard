import postgres from "postgres";
import {
  AccountProfileSchema,
  AccountSnapshotSchema,
  ApplicationSchema,
  HookSchema,
  ReelMetricSnapshotSchema,
  ReelSchema,
} from "@/lib/schemas";
import type { WorkspaceRepositories } from "@/lib/store/workspace";

interface PayloadRow {
  payload: unknown;
}

function parseRows<T>(rows: PayloadRow[], parse: (value: unknown) => T): T[] {
  return rows.map((row) => parse(row.payload));
}

export function createPostgresRepositories(databaseUrl: string): WorkspaceRepositories {
  const sql = postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const ready = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS instagram_dashboard_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;
    await sql`
      INSERT INTO instagram_dashboard_metadata(key, value)
      VALUES ('schema_version', '1')
      ON CONFLICT(key) DO NOTHING
    `;
    const [metadata] = await sql<{ value: string }[]>`
      SELECT value FROM instagram_dashboard_metadata WHERE key = 'schema_version'
    `;
    if (Number(metadata?.value) > 1) {
      throw new Error(
        `PostgreSQL schema version ${metadata.value} is newer than this app supports (1).`,
      );
    }
    await sql`
      CREATE TABLE IF NOT EXISTS instagram_dashboard_records (
        namespace TEXT NOT NULL,
        record_key TEXT NOT NULL,
        owner_key TEXT,
        sort_key TEXT NOT NULL,
        payload JSONB NOT NULL,
        PRIMARY KEY (namespace, record_key)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS instagram_dashboard_records_owner
      ON instagram_dashboard_records(namespace, owner_key, sort_key)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS instagram_dashboard_records_sort
      ON instagram_dashboard_records(namespace, sort_key)
    `;
  })();

  async function upsertRecord(
    namespace: string,
    recordKey: string,
    ownerKey: string | null,
    sortKey: string,
    payload: postgres.JSONValue,
  ) {
    await ready;
    await sql`
      INSERT INTO instagram_dashboard_records(
        namespace, record_key, owner_key, sort_key, payload
      )
      VALUES (
        ${namespace}, ${recordKey}, ${ownerKey}, ${sortKey}, ${sql.json(payload)}
      )
      ON CONFLICT(namespace, record_key) DO UPDATE SET
        owner_key = excluded.owner_key,
        sort_key = excluded.sort_key,
        payload = excluded.payload
    `;
  }

  const reels: WorkspaceRepositories["reels"] = {
    async list() {
      await ready;
      const rows = await sql<PayloadRow[]>`
        SELECT payload FROM instagram_dashboard_records
        WHERE namespace = 'reel'
        ORDER BY sort_key, record_key
      `;
      return parseRows(rows, (value) => ReelSchema.parse(value));
    },
    async get(id) {
      await ready;
      const [row] = await sql<PayloadRow[]>`
        SELECT payload FROM instagram_dashboard_records
        WHERE namespace = 'reel' AND record_key = ${id}
      `;
      return row ? ReelSchema.parse(row.payload) : null;
    },
    async upsert(reel) {
      const validated = ReelSchema.parse(reel);
      await upsertRecord("reel", validated.id, null, validated.postedAt, validated);
      return validated;
    },
    async removeMany(ids) {
      if (ids.length === 0) return 0;
      await ready;
      return sql.begin(async (transaction) => {
        let removed = 0;
        for (const id of ids) {
          const result = await transaction`
            DELETE FROM instagram_dashboard_records
            WHERE namespace = 'reel' AND record_key = ${id}
          `;
          removed += result.count;
        }
        return removed;
      });
    },
  };

  const accounts: WorkspaceRepositories["accounts"] = {
    async list() {
      await ready;
      const rows = await sql<PayloadRow[]>`
        SELECT payload FROM instagram_dashboard_records
        WHERE namespace = 'account-snapshot'
        ORDER BY sort_key, record_key
      `;
      return parseRows(rows, (value) => AccountSnapshotSchema.parse(value));
    },
    async add(snapshot) {
      const validated = AccountSnapshotSchema.parse(snapshot);
      await upsertRecord(
        "account-snapshot",
        validated.date,
        null,
        validated.date,
        validated,
      );
      return validated;
    },
  };

  const profile: WorkspaceRepositories["profile"] = {
    async get() {
      await ready;
      const [row] = await sql<PayloadRow[]>`
        SELECT payload FROM instagram_dashboard_records
        WHERE namespace = 'profile' AND record_key = 'current'
      `;
      return row ? AccountProfileSchema.parse(row.payload) : null;
    },
    async save(profileValue) {
      const validated = AccountProfileSchema.parse(profileValue);
      await upsertRecord("profile", "current", null, validated.updatedAt, validated);
      return validated;
    },
  };

  const reelHistory: WorkspaceRepositories["reelHistory"] = {
    async list(reelId) {
      await ready;
      const rows = await sql<PayloadRow[]>`
        SELECT payload FROM instagram_dashboard_records
        WHERE namespace = 'reel-history' AND owner_key = ${reelId}
        ORDER BY sort_key, record_key
      `;
      return parseRows(rows, (value) => ReelMetricSnapshotSchema.parse(value));
    },
    async listAll() {
      await ready;
      const rows = await sql<PayloadRow[]>`
        SELECT payload FROM instagram_dashboard_records
        WHERE namespace = 'reel-history'
        ORDER BY sort_key, record_key
      `;
      return parseRows(rows, (value) => ReelMetricSnapshotSchema.parse(value));
    },
    async add(snapshot) {
      const validated = ReelMetricSnapshotSchema.parse(snapshot);
      await upsertRecord(
        "reel-history",
        `${validated.reelId}\u001f${validated.date}`,
        validated.reelId,
        validated.date,
        validated,
      );
      return validated;
    },
    async removeByReelIds(reelIds) {
      if (reelIds.length === 0) return 0;
      await ready;
      return sql.begin(async (transaction) => {
        let removed = 0;
        for (const reelId of reelIds) {
          const result = await transaction`
            DELETE FROM instagram_dashboard_records
            WHERE namespace = 'reel-history' AND owner_key = ${reelId}
          `;
          removed += result.count;
        }
        return removed;
      });
    },
  };

  // 신청은 responseId가 유일 키, submittedAt이 정렬 키다.
  const applications: WorkspaceRepositories["applications"] = {
    async list() {
      await ready;
      const rows = await sql<PayloadRow[]>`
        SELECT payload FROM instagram_dashboard_records
        WHERE namespace = 'application'
        ORDER BY sort_key, record_key
      `;
      return parseRows(rows, (value) => ApplicationSchema.parse(value));
    },
    async upsertMany(incoming) {
      const validated = incoming.map((application) => ApplicationSchema.parse(application));
      if (validated.length === 0) return 0;
      await ready;
      await sql.begin(async () => {
        for (const application of validated) {
          await upsertRecord(
            "application",
            application.responseId,
            null,
            application.submittedAt,
            application,
          );
        }
      });
      return validated.length;
    },
  };

  // 훅은 id가 유일 키, createdAt이 정렬 키다.
  const hooks: WorkspaceRepositories["hooks"] = {
    async list() {
      await ready;
      const rows = await sql<PayloadRow[]>`
        SELECT payload FROM instagram_dashboard_records
        WHERE namespace = 'hook'
        ORDER BY sort_key, record_key
      `;
      return parseRows(rows, (value) => HookSchema.parse(value));
    },
    async get(id) {
      await ready;
      const [row] = await sql<PayloadRow[]>`
        SELECT payload FROM instagram_dashboard_records
        WHERE namespace = 'hook' AND record_key = ${id}
      `;
      return row ? HookSchema.parse(row.payload) : null;
    },
    async upsert(hook) {
      const validated = HookSchema.parse(hook);
      await upsertRecord("hook", validated.id, null, validated.createdAt, validated);
      return validated;
    },
    async remove(id) {
      await ready;
      const result = await sql`
        DELETE FROM instagram_dashboard_records
        WHERE namespace = 'hook' AND record_key = ${id}
      `;
      return result.count > 0;
    },
  };

  return {
    reels,
    accounts,
    profile,
    reelHistory,
    applications,
    hooks,
    close: async () => {
      await ready.catch(() => undefined);
      await sql.end({ timeout: 5 });
    },
  };
}
