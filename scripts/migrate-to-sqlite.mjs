#!/usr/bin/env node
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, process.env.DATA_DIR?.trim() || "data");
const databasePath = resolve(
  root,
  process.env.SQLITE_DATABASE_PATH?.trim() || join(dataDir, "instagram-dashboard.sqlite"),
);

async function readJson(name, fallback) {
  const path = join(dataDir, name);
  if (!existsSync(path)) return fallback;
  const raw = await readFile(path, "utf8");
  return raw.trim() ? JSON.parse(raw) : fallback;
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must contain a JSON array.`);
  return value;
}

function requireString(value, field, source) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${source} contains a record without a valid ${field}.`);
  }
  return value;
}

const [reels, snapshots, profile, reelHistory] = await Promise.all([
  readJson("reels.json", []),
  readJson("snapshots.json", []),
  readJson("profile.json", null),
  readJson("reel-history.json", []),
]);
requireArray(reels, "reels.json");
requireArray(snapshots, "snapshots.json");
requireArray(reelHistory, "reel-history.json");
if (profile !== null && (typeof profile !== "object" || Array.isArray(profile))) {
  throw new Error("profile.json must contain a JSON object.");
}

await mkdir(dirname(databasePath), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
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

const existing = db.prepare("SELECT count(*) AS count FROM workspace_records").get();
if (Number(existing.count) > 0 && !process.argv.includes("--merge")) {
  db.close();
  throw new Error(
    "The SQLite database already contains records. Re-run with --merge only if upserting JSON data is intentional.",
  );
}

const upsert = db.prepare(`
  INSERT INTO workspace_records(namespace, record_key, owner_key, sort_key, payload)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(namespace, record_key) DO UPDATE SET
    owner_key = excluded.owner_key,
    sort_key = excluded.sort_key,
    payload = excluded.payload
`);

let migrated = 0;
db.exec("BEGIN IMMEDIATE");
try {
  for (const reel of reels) {
    const id = requireString(reel?.id, "id", "reels.json");
    const postedAt = requireString(reel?.postedAt, "postedAt", "reels.json");
    upsert.run("reel", id, null, postedAt, JSON.stringify(reel));
    migrated += 1;
  }
  for (const snapshot of snapshots) {
    const date = requireString(snapshot?.date, "date", "snapshots.json");
    upsert.run("account-snapshot", date, null, date, JSON.stringify(snapshot));
    migrated += 1;
  }
  if (profile) {
    const updatedAt = requireString(profile.updatedAt, "updatedAt", "profile.json");
    upsert.run("profile", "current", null, updatedAt, JSON.stringify(profile));
    migrated += 1;
  }
  for (const snapshot of reelHistory) {
    const reelId = requireString(snapshot?.reelId, "reelId", "reel-history.json");
    const date = requireString(snapshot?.date, "date", "reel-history.json");
    upsert.run(
      "reel-history",
      `${reelId}\u001f${date}`,
      reelId,
      date,
      JSON.stringify(snapshot),
    );
    migrated += 1;
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
if (process.platform !== "win32") await chmod(databasePath, 0o600);

process.stdout.write(`Migrated ${migrated} record(s) into ${databasePath}\n`);
process.stdout.write("Set STORAGE_ADAPTER=sqlite to use the SQLite database.\n");
