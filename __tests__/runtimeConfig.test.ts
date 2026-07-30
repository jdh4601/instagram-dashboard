import { resolveRuntimeConfig } from "@/lib/runtime/config";

test("DATA_DIR이 없으면 cwd/data를 사용한다", () => {
  expect(resolveRuntimeConfig({}, "/workspace")).toEqual({
    dataDir: "/workspace/data",
    storageAdapter: "json",
    sqliteDatabasePath: "/workspace/data/instagram-dashboard.sqlite",
    postgresDatabaseUrl: null,
  });
});

test("상대 DATA_DIR은 cwd 기준 절대 경로로 바꾼다", () => {
  expect(resolveRuntimeConfig({ DATA_DIR: "var/instagram" }, "/workspace").dataDir)
    .toBe("/workspace/var/instagram");
});

test("절대 DATA_DIR은 그대로 사용한다", () => {
  expect(resolveRuntimeConfig({ DATA_DIR: "/srv/instagram" }, "/workspace").dataDir)
    .toBe("/srv/instagram");
});

test("SQLite adapter와 별도 DB 경로를 선택할 수 있다", () => {
  expect(
    resolveRuntimeConfig(
      { STORAGE_ADAPTER: "SQLITE", SQLITE_DATABASE_PATH: "var/dashboard.sqlite" },
      "/workspace",
    ),
  ).toMatchObject({
    storageAdapter: "sqlite",
    sqliteDatabasePath: "/workspace/var/dashboard.sqlite",
  });
});

test("알 수 없는 storage adapter는 조용히 폴백하지 않는다", () => {
  expect(() => resolveRuntimeConfig({ STORAGE_ADAPTER: "redis" }, "/workspace"))
    .toThrow("STORAGE_ADAPTER");
});

test("PostgreSQL adapter는 DATABASE_URL을 별도 런타임 값으로 전달한다", () => {
  expect(
    resolveRuntimeConfig(
      { STORAGE_ADAPTER: "postgres", DATABASE_URL: "postgres://localhost/dashboard" },
      "/workspace",
    ),
  ).toMatchObject({
    storageAdapter: "postgres",
    postgresDatabaseUrl: "postgres://localhost/dashboard",
  });
});
