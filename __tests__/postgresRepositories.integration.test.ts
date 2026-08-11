import { createPostgresRepositories } from "@/lib/store/postgresRepositories";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationTest = databaseUrl ? test : test.skip;

integrationTest("PostgreSQL workspace는 Repository 계약과 프로세스 재연결을 유지한다", async () => {
  const first = createPostgresRepositories(databaseUrl!);
  await first.reels.removeMany(["pg-contract-reel"]);
  await first.reels.upsert({
    id: "pg-contract-reel",
    postedAt: "2026-07-01T00:00:00Z",
    durationSec: 20,
    views: 10,
    reach: 8,
    likes: 1,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 8,
  });
  await first.close?.();

  const second = createPostgresRepositories(databaseUrl!);
  try {
    expect(await second.reels.get("pg-contract-reel")).toMatchObject({
      id: "pg-contract-reel",
      views: 10,
    });
    expect(await second.reels.removeMany(["pg-contract-reel"])).toBe(1);
  } finally {
    await second.close?.();
  }
});

integrationTest("PostgreSQL workspace는 훅 북마크 계약을 지킨다", async () => {
  const store = createPostgresRepositories(databaseUrl!);
  try {
    await store.hooks.remove("pg-contract-hook");
    await store.hooks.upsert({
      id: "pg-contract-hook",
      text: "이걸 모르면 1년을 날립니다",
      category: "problem",
      isFavorite: false,
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-01T09:00:00.000Z",
    });
    expect(await store.hooks.get("pg-contract-hook")).toMatchObject({ category: "problem" });
    expect(await store.hooks.remove("pg-contract-hook")).toBe(true);
    expect(await store.hooks.remove("pg-contract-hook")).toBe(false);
  } finally {
    await store.close?.();
  }
});
