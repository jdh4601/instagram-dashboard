import { resolve } from "node:path";

export interface RuntimeConfig {
  dataDir: string;
  storageAdapter: "json" | "sqlite" | "postgres";
  sqliteDatabasePath: string;
  postgresDatabaseUrl: string | null;
}

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Resolve process-level configuration once at each caller's initialization seam.
 *
 * DATA_DIR may be absolute or relative to the process working directory. Keeping this
 * rule here prevents repositories and credential settings from silently using different
 * directories in custom deployments.
 */
export function resolveRuntimeConfig(
  env: RuntimeEnvironment = process.env,
  cwd: string = process.cwd(),
): RuntimeConfig {
  const configuredDataDir = env.DATA_DIR?.trim();
  const dataDir = resolve(cwd, configuredDataDir || "data");
  const configuredAdapter = env.STORAGE_ADAPTER?.trim().toLowerCase() || "json";
  if (
    configuredAdapter !== "json" &&
    configuredAdapter !== "sqlite" &&
    configuredAdapter !== "postgres"
  ) {
    throw new Error("STORAGE_ADAPTER must be 'json', 'sqlite', or 'postgres'.");
  }
  const configuredDatabasePath = env.SQLITE_DATABASE_PATH?.trim();
  return {
    dataDir,
    storageAdapter: configuredAdapter,
    sqliteDatabasePath: resolve(cwd, configuredDatabasePath || resolve(dataDir, "instagram-dashboard.sqlite")),
    postgresDatabaseUrl: env.DATABASE_URL?.trim() || null,
  };
}
