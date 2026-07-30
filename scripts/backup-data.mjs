#!/usr/bin/env node
import { chmod, copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, process.env.DATA_DIR?.trim() || "data");
const backupRoot = resolve(root, process.env.BACKUP_DIR?.trim() || "backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = join(backupRoot, `instagram-dashboard-${timestamp}`);
const dataFiles = ["reels.json", "snapshots.json", "profile.json", "reel-history.json"];

await mkdir(destination, { recursive: true, mode: 0o700 });
const copied = [];

for (const name of dataFiles) {
  const source = join(dataDir, name);
  if (!existsSync(source)) continue;
  const target = join(destination, name);
  await copyFile(source, target);
  if (process.platform !== "win32") await chmod(target, 0o600);
  copied.push({ name, bytes: (await stat(target)).size });
}

const sqliteSource = resolve(
  root,
  process.env.SQLITE_DATABASE_PATH?.trim() || join(dataDir, "instagram-dashboard.sqlite"),
);
if (existsSync(sqliteSource)) {
  const sqliteTarget = join(destination, "instagram-dashboard.sqlite");
  const { backup, DatabaseSync } = await import("node:sqlite");
  const sourceDatabase = new DatabaseSync(sqliteSource, { readOnly: true });
  try {
    await backup(sourceDatabase, sqliteTarget);
  } finally {
    sourceDatabase.close();
  }
  if (process.platform !== "win32") await chmod(sqliteTarget, 0o600);
  copied.push({ name: "instagram-dashboard.sqlite", bytes: (await stat(sqliteTarget)).size });
}

const manifest = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  includesSecrets: false,
  files: copied,
};
await writeFile(join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});

process.stdout.write(`Backup created: ${destination}\n`);
process.stdout.write(`Copied ${copied.length} data file(s). settings.json was intentionally excluded.\n`);
