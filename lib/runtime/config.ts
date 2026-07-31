import { resolve } from "node:path";

export interface RuntimeConfig {
  dataDir: string;
  storageAdapter: "json" | "sqlite" | "postgres";
  sqliteDatabasePath: string;
  postgresDatabaseUrl: string | null;
  /**
   * 이 프로세스가 사용자의 PC에서 돌고 있는지. 로컬 CLI 챗봇은 서버가 자식 프로세스를
   * 띄워야 해서 서버리스 배포에서는 성립하지 않으므로, 해당 기능을 이 값으로 가둔다.
   */
  isLocalRuntime: boolean;
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
    isLocalRuntime: !env.VERCEL,
  };
}
