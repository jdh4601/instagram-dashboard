#!/usr/bin/env node
// 데모 데이터를 data/ 로 복사해 clone 직후 대시보드가 채워진 상태로 뜨게 한다.
//   npm run seed:demo            # data/가 비어 있을 때만 시딩
//   npm run seed:demo -- --force # 기존 data/를 덮어씀(주의: 실제 계정 데이터가 있으면 사라짐)
//
// 이 데이터는 전부 가상의 예시 계정(@founder.reels.demo)이며 실제 계정과 무관하다.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "examples", "demo-data");
const dataDir = join(root, "data");
const force = process.argv.includes("--force");

// lib/analysis/metrics.ts의 computeDerivedRates를 데모 시딩용으로 최소 포팅한 것.
// (실제 앱 로직의 단일 출처는 TypeScript 쪽이며, 여기는 정적 데모 데이터 생성 전용)
function rate(n, d) {
  return d > 0 ? (n / d) * 100 : 0;
}
function optRate(n, d) {
  return n === undefined || d <= 0 ? undefined : (n / d) * 100;
}
function computeDerived(r) {
  const engagement = r.likes + r.comments + r.saves + r.shares;
  const total = r.totalInteractions ?? engagement;
  const d = {
    shareRate: rate(r.shares, r.views),
    saveRate: rate(r.saves, r.views),
    likeRate: rate(r.likes, r.views),
    commentRate: rate(r.comments, r.views),
    engagementRate: rate(engagement, r.views),
    completionRate: rate(r.avgWatchTimeSec, r.durationSec),
    interactionRateByReach: optRate(total, r.reach),
    interactionRateByView: optRate(total, r.views),
    saveRateByReach: optRate(r.saves, r.reach),
    shareRateByReach: optRate(r.shares, r.reach),
    highIntentRate: optRate(r.saves + r.shares, r.reach),
    playsPerReachedAccount: r.reach > 0 ? r.views / r.reach : undefined,
    averageWatchPercentage: r.durationSec > 0 ? (r.avgWatchTimeSec / r.durationSec) * 100 : undefined,
  };
  if (r.followsFromReel !== undefined) {
    d.followRate = rate(r.followsFromReel, r.views);
    d.followConversionRate = rate(r.followsFromReel, r.reach);
  }
  if (r.profileVisits !== undefined) d.profileVisitRate = rate(r.profileVisits, r.reach);
  if (r.followsFromReel !== undefined && r.profileVisits !== undefined) {
    d.profileToFollowRate = optRate(r.followsFromReel, r.profileVisits);
  }
  return d;
}

async function readJson(name) {
  return JSON.parse(await readFile(join(srcDir, name), "utf8"));
}

async function main() {
  const reelsFile = join(dataDir, "reels.json");
  if (existsSync(reelsFile) && !force) {
    const existing = JSON.parse((await readFile(reelsFile, "utf8")) || "[]");
    if (Array.isArray(existing) && existing.length > 0) {
      console.error(
        "data/reels.json 에 이미 데이터가 있습니다. 덮어쓰려면 `npm run seed:demo -- --force` 를 쓰세요.",
      );
      process.exit(1);
    }
  }

  if (!existsSync(dataDir)) await mkdir(dataDir, { recursive: true });

  const reels = (await readJson("reels.json")).map((r) => ({ ...r, derived: computeDerived(r) }));
  const snapshots = await readJson("snapshots.json");
  const profile = await readJson("profile.json");

  await writeFile(reelsFile, JSON.stringify(reels, null, 2), "utf8");
  await writeFile(join(dataDir, "snapshots.json"), JSON.stringify(snapshots, null, 2), "utf8");
  await writeFile(join(dataDir, "profile.json"), JSON.stringify(profile, null, 2), "utf8");

  console.log(
    `데모 데이터 시딩 완료 → 릴스 ${reels.length}개 · 스냅샷 ${snapshots.length}개 · @${profile.username}`,
  );
  console.log("이제 `npm run dev` 로 대시보드를 열어보세요.");
}

main().catch((err) => {
  console.error("데모 시딩 실패:", err);
  process.exit(1);
});
