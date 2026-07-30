import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();

test("doctor는 불완전한 인증을 실패 처리하고 비밀값을 출력하지 않는다", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "doctor-data-"));
  const secret = "do-not-print-this-password";
  const result = spawnSync(process.execPath, ["scripts/doctor.mjs", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      DASHBOARD_USER: "admin",
      DASHBOARD_PASSWORD: "",
      CRON_SECRET: "",
      RESEND_API_KEY: "",
      REPORT_EMAIL_FROM: "",
      REPORT_EMAIL_TO: "",
      DOCTOR_FFPROBE_COMMAND: "definitely-not-an-installed-binary",
      UNUSED_TEST_SECRET: secret,
    },
  });

  expect(result.status).toBe(1);
  expect(result.stdout).not.toContain(secret);
  const report = JSON.parse(result.stdout);
  expect(report.results).toContainEqual(
    expect.objectContaining({ id: "auth", level: "error" }),
  );
  expect(report.results).toContainEqual(
    expect.objectContaining({ id: "ffprobe", level: "warning" }),
  );
});

test("backup은 분석 데이터만 복사하고 settings.json은 제외한다", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "backup-data-"));
  const dataDir = join(sandbox, "data");
  const backupDir = join(sandbox, "backups");
  mkdirSync(dataDir);
  writeFileSync(join(dataDir, "reels.json"), "[]\n");
  writeFileSync(join(dataDir, "settings.json"), '{"instagram":{"accessToken":"secret"}}\n');

  const result = spawnSync(process.execPath, ["scripts/backup-data.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, DATA_DIR: dataDir, BACKUP_DIR: backupDir },
  });

  expect(result.status).toBe(0);
  const [created] = readdirSync(backupDir);
  const files = readdirSync(join(backupDir, created));
  expect(files).toContain("reels.json");
  expect(files).toContain("manifest.json");
  expect(files).not.toContain("settings.json");
  const manifest = JSON.parse(readFileSync(join(backupDir, created, "manifest.json"), "utf8"));
  expect(manifest).toMatchObject({ schemaVersion: 1, includesSecrets: false });
});

test("backup은 WAL 모드 SQLite 데이터베이스의 일관된 사본을 만든다", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "backup-sqlite-"));
  const dataDir = join(sandbox, "data");
  const backupDir = join(sandbox, "backups");
  mkdirSync(dataDir);
  const sourcePath = join(dataDir, "instagram-dashboard.sqlite");
  const source = new DatabaseSync(sourcePath);
  source.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE records(value TEXT); INSERT INTO records VALUES ('ok');",
  );

  const result = spawnSync(process.execPath, ["scripts/backup-data.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, DATA_DIR: dataDir, BACKUP_DIR: backupDir },
  });
  source.close();

  expect(result.status).toBe(0);
  const [created] = readdirSync(backupDir);
  const targetPath = join(backupDir, created, "instagram-dashboard.sqlite");
  const target = new DatabaseSync(targetPath, { readOnly: true });
  expect(target.prepare("SELECT value FROM records").get()).toEqual({ value: "ok" });
  target.close();
});

test("JSON→SQLite 마이그레이션은 데이터를 옮기고 기존 DB 재실행을 기본 거부한다", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "migrate-sqlite-"));
  const dataDir = join(sandbox, "data");
  const databasePath = join(sandbox, "workspace.sqlite");
  mkdirSync(dataDir);
  writeFileSync(
    join(dataDir, "reels.json"),
    JSON.stringify([{ id: "r1", postedAt: "2026-07-01T00:00:00Z" }]),
  );

  const env = {
    ...process.env,
    DATA_DIR: dataDir,
    SQLITE_DATABASE_PATH: databasePath,
  };
  const first = spawnSync(process.execPath, ["scripts/migrate-to-sqlite.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env,
  });
  expect(first.status).toBe(0);
  const database = new DatabaseSync(databasePath, { readOnly: true });
  expect(
    database.prepare("SELECT count(*) AS count FROM workspace_records").get(),
  ).toEqual({ count: 1 });
  database.close();

  const second = spawnSync(process.execPath, ["scripts/migrate-to-sqlite.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env,
  });
  expect(second.status).not.toBe(0);
  expect(second.stderr).toContain("--merge");
});
