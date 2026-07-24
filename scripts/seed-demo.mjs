#!/usr/bin/env node
// 데모 데이터를 data/ 로 복사해 clone 직후 대시보드가 채워진 상태로 뜨게 한다.
//   npm run seed:demo            # data/의 세 파일이 모두 비어 있을 때만 시딩
//   npm run seed:demo -- --force # 기존 파일을 <이름>.bak-<타임스탬프>로 백업한 뒤 덮어씀
//
// 환경변수:
//   DATA_DIR      시딩 대상 디렉터리 (기본 <repo>/data, lib/store와 동일한 규약)
//   DEMO_DATA_DIR 데모 원본 디렉터리 (기본 <repo>/examples/demo-data, 테스트용)
//
// 이 데이터는 전부 가상의 예시 계정(@founder.reels.demo)이며 실제 계정과 무관하다.
import { copyFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = process.env.DEMO_DATA_DIR
  ? resolve(process.env.DEMO_DATA_DIR)
  : join(root, "examples", "demo-data");
const dataDir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : join(root, "data");
const force = process.argv.includes("--force");

const DATA_FILES = ["reels.json", "snapshots.json", "profile.json"];

// lib/analysis/metrics.ts의 computeDerivedRates를 데모 시딩용으로 포팅한 것.
// (실제 앱 로직의 단일 출처는 TypeScript 쪽이며, 여기는 정적 데모 데이터 생성 전용.
//  필드 추가·수정 시 __tests__/demoData.parity.test.ts 가 drift를 잡아낸다)
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
    commentRateByReach: optRate(r.comments, r.reach),
    likeRateByReach: optRate(r.likes, r.reach),
    highIntentRate: optRate(r.saves + r.shares, r.reach),
    playsPerReachedAccount: r.reach > 0 ? r.views / r.reach : undefined,
    replayRate: optRate(r.replays, r.views),
    watchTimePerView:
      r.totalWatchTimeSec !== undefined && r.views > 0
        ? r.totalWatchTimeSec / r.views
        : undefined,
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

// "내용이 있는" 파일이면 true. 빈 배열/빈 객체는 시딩을 막지 않고,
// 깨진 JSON·스칼라처럼 판단이 어려운 경우는 보존 쪽(막기)으로 처리한다.
async function fileHasData(path) {
  if (!existsSync(path)) return false;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed !== null && typeof parsed === "object") return Object.keys(parsed).length > 0;
    return true;
  } catch {
    return true;
  }
}

async function main() {
  const blocked = [];
  for (const name of DATA_FILES) {
    if (await fileHasData(join(dataDir, name))) blocked.push(name);
  }
  if (!force && blocked.length > 0) {
    console.error(`data/ 에 이미 데이터가 있습니다: ${blocked.join(", ")}`);
    console.error(
      "덮어쓰려면 `npm run seed:demo -- --force` 를 쓰세요. 기존 파일은 .bak-<타임스탬프>로 백업됩니다.",
    );
    process.exit(1);
  }

  if (!existsSync(dataDir)) await mkdir(dataDir, { recursive: true });

  if (force) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    for (const name of DATA_FILES) {
      const target = join(dataDir, name);
      if (existsSync(target)) {
        await copyFile(target, `${target}.bak-${ts}`);
        console.log(`백업: ${name} → ${name}.bak-${ts}`);
      }
    }
  }

  const reels = (await readJson("reels.json")).map((r) => ({ ...r, derived: computeDerived(r) }));
  const snapshots = await readJson("snapshots.json");
  const profile = await readJson("profile.json");

  await writeFile(join(dataDir, "reels.json"), JSON.stringify(reels, null, 2), "utf8");
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
