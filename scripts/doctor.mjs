#!/usr/bin/env node
import { constants } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const jsonOutput = args.has("--json");
const strict = args.has("--strict");
const results = [];

function add(id, level, message) {
  results.push({ id, level, message });
}

function configured(name) {
  return Boolean(process.env[name]);
}

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map((part) => Number.parseInt(part, 10));
if (nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 16)) {
  add("node", "ok", `Node ${process.versions.node} is supported.`);
} else {
  add("node", "error", `Node ${process.versions.node} is unsupported; use Node 22.16 or newer.`);
}

const dataDir = resolve(process.cwd(), process.env.DATA_DIR?.trim() || "data");
const relativeDataDir = relative(process.cwd(), dataDir);
const dataDirLabel =
  relativeDataDir && !relativeDataDir.startsWith("..") && !isAbsolute(relativeDataDir)
    ? relativeDataDir
    : "<external DATA_DIR>";
try {
  try {
    const target = await stat(dataDir);
    if (!target.isDirectory()) throw new Error("DATA_DIR is not a directory");
    await access(dataDir, constants.R_OK | constants.W_OK);
    add("data-dir", "ok", `Data directory is readable and writable: ${dataDirLabel}`);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
    let parent = dirname(dataDir);
    while (true) {
      try {
        const candidate = await stat(parent);
        if (!candidate.isDirectory()) throw new Error("DATA_DIR parent is not a directory");
        await access(parent, constants.R_OK | constants.W_OK);
        add("data-dir", "ok", `Data directory can be created under a writable parent: ${dataDirLabel}`);
        break;
      } catch (parentError) {
        if (!(parentError && typeof parentError === "object" && "code" in parentError && parentError.code === "ENOENT")) {
          throw parentError;
        }
        const next = dirname(parent);
        if (next === parent) throw parentError;
        parent = next;
      }
    }
  }
} catch {
  add("data-dir", "error", `Data directory is not readable and writable: ${dataDirLabel}`);
}

const storageAdapter = process.env.STORAGE_ADAPTER?.trim().toLowerCase() || "json";
if (!["json", "sqlite", "postgres"].includes(storageAdapter)) {
  add("storage", "error", "STORAGE_ADAPTER must be json, sqlite, or postgres.");
} else if (storageAdapter === "postgres" && !configured("DATABASE_URL")) {
  add("storage", "error", "DATABASE_URL is required when STORAGE_ADAPTER=postgres.");
} else {
  add(
    "storage",
    "ok",
    `${storageAdapter === "postgres" ? "PostgreSQL" : storageAdapter === "sqlite" ? "SQLite" : "JSON"} storage is selected.`,
  );
}

const ffprobeCommand = process.env.DOCTOR_FFPROBE_COMMAND?.trim() || "ffprobe";
const ffprobe = spawnSync(ffprobeCommand, ["-version"], {
  stdio: "ignore",
  timeout: 3_000,
});
if (ffprobe.status === 0) {
  add("ffprobe", "ok", "ffprobe is available for Reel duration probing.");
} else {
  add("ffprobe", "warning", "ffprobe is unavailable; duration-based metrics may be missing.");
}

const authUser = configured("DASHBOARD_USER");
const authPassword = configured("DASHBOARD_PASSWORD");
if (authUser && authPassword) {
  add("auth", "ok", "Dashboard Basic Auth is enabled.");
} else if (authUser || authPassword) {
  add("auth", "error", "Set both DASHBOARD_USER and DASHBOARD_PASSWORD, or neither.");
} else {
  add("auth", "warning", "Dashboard Basic Auth is disabled; keep the app on localhost or a trusted network.");
}

const instagramOAuthNames = [
  "INSTAGRAM_APP_ID",
  "INSTAGRAM_APP_SECRET",
  "INSTAGRAM_OAUTH_REDIRECT_URI",
];
const instagramOAuthConfigured = instagramOAuthNames.filter(configured);
if (instagramOAuthConfigured.length === 0) {
  add("instagram-oauth", "ok", "Instagram OAuth is disabled; manual token entry remains available.");
} else if (instagramOAuthConfigured.length === instagramOAuthNames.length) {
  add("instagram-oauth", "ok", "Instagram OAuth is configured.");
} else {
  const missing = instagramOAuthNames.filter((name) => !configured(name));
  add("instagram-oauth", "error", `Instagram OAuth configuration is incomplete; missing ${missing.join(", ")}.`);
}

if (process.platform !== "win32") {
  const envFiles = (await readdir(process.cwd()))
    .filter((name) => /^\.env(?:\.|$)/.test(name) && name !== ".env.example");
  const broadlyReadable = [];
  for (const name of envFiles) {
    const mode = (await stat(resolve(process.cwd(), name))).mode & 0o777;
    if ((mode & 0o077) !== 0) broadlyReadable.push(name);
  }
  if (broadlyReadable.length > 0) {
    add(
      "env-permissions",
      "warning",
      `${broadlyReadable.length} environment file(s) are readable by users other than their owner; use chmod 600.`,
    );
  } else {
    add("env-permissions", "ok", "Environment files are absent or owner-only.");
  }
}

const reportNames = [
  "CRON_SECRET",
  "RESEND_API_KEY",
  "REPORT_EMAIL_FROM",
  "REPORT_EMAIL_TO",
];
const reportConfigured = reportNames.filter(configured);
if (reportConfigured.length === 0) {
  add("daily-report", "ok", "Daily email reporting is disabled.");
} else if (reportConfigured.length === reportNames.length) {
  add("daily-report", "ok", "Daily email reporting is configured.");
} else {
  const missing = reportNames.filter((name) => !configured(name));
  add("daily-report", "warning", `Daily email reporting is incomplete; missing ${missing.join(", ")}.`);
}

const settingsPath = resolve(dataDir, "settings.json");
try {
  const raw = await readFile(settingsPath, "utf8");
  const settings = JSON.parse(raw);
  const providerCount = Object.values(settings.providers ?? {})
    .filter((provider) => Boolean(provider?.apiKey))
    .length;
  const instagramConfigured = Boolean(
    process.env.INSTAGRAM_ACCESS_TOKEN || settings.instagram?.accessToken,
  );
  const activeProvider = settings.textProvider ?? settings.activeProvider ?? "anthropic";
  const activeProviderConfigured = Boolean(
    settings.providers?.[activeProvider]?.apiKey ||
      (activeProvider === "anthropic" && process.env.ANTHROPIC_API_KEY),
  );
  add(
    "settings",
    "ok",
    `Settings file is valid; Instagram ${instagramConfigured ? "configured" : "not configured"}, ` +
      `${providerCount} LLM provider key(s) configured.`,
  );
  add(
    "llm",
    activeProviderConfigured ? "ok" : "warning",
    activeProviderConfigured
      ? "The active LLM provider is configured."
      : "The active LLM provider has no API key.",
  );

  if (process.platform !== "win32") {
    const mode = (await stat(settingsPath)).mode & 0o777;
    if ((mode & 0o077) === 0) {
      add("settings-permissions", "ok", "settings.json permissions are owner-only.");
    } else {
      add("settings-permissions", "warning", "settings.json is readable by users other than its owner.");
    }
  }
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    add("settings", "ok", "No settings file yet; configure Instagram and an LLM provider in /settings.");
  } else {
    add("settings", "error", "settings.json exists but is not valid JSON.");
  }
}

const summary = {
  ok: results.filter((result) => result.level === "ok").length,
  warnings: results.filter((result) => result.level === "warning").length,
  errors: results.filter((result) => result.level === "error").length,
};

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify({ summary, results }, null, 2)}\n`);
} else {
  for (const result of results) {
    const icon = result.level === "ok" ? "✓" : result.level === "warning" ? "!" : "✗";
    process.stdout.write(`${icon} [${result.id}] ${result.message}\n`);
  }
  process.stdout.write(
    `\nDoctor summary: ${summary.ok} ok, ${summary.warnings} warning(s), ${summary.errors} error(s).\n`,
  );
}

if (summary.errors > 0) process.exitCode = 1;
else if (strict && summary.warnings > 0) process.exitCode = 2;
