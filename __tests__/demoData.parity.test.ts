/**
 * scripts/seed-demo.mjs 가 계산해 심는 derived 지표가 단일 출처인
 * lib/analysis/metrics.ts의 computeDerivedRates와 항상 일치하는지 검증한다.
 * 시드 스크립트의 JS 포팅이 drift하면 이 테스트가 실패한다.
 *
 * 실행은 전부 임시 디렉터리(DATA_DIR/DEMO_DATA_DIR)에서만 일어나며
 * 실제 ./data 디렉터리는 건드리지 않는다.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { ReelSchema } from "@/lib/schemas";

const root = join(__dirname, "..");
const seedScript = join(root, "scripts", "seed-demo.mjs");
const demoDir = join(root, "examples", "demo-data");
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

let dataDirTmp: string;
beforeEach(() => {
  dataDirTmp = mkdtempSync(join(tmpdir(), "seed-demo-data-"));
});
afterEach(() => {
  rmSync(dataDirTmp, { recursive: true, force: true });
});

function runSeed(args: string[] = [], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [seedScript, ...args], {
    env: { ...process.env, DATA_DIR: dataDirTmp, ...env },
    encoding: "utf8",
  });
}

describe("seed-demo derived parity with lib/analysis/metrics", () => {
  it("seeds derived identical to computeDerivedRates for every demo reel", () => {
    const res = runSeed();
    expect(res.status).toBe(0);

    const inputs = z.array(ReelSchema).parse(readJson(join(demoDir, "reels.json")));
    const seeded = readJson(join(dataDirTmp, "reels.json")) as Array<{
      id: string;
      derived: unknown;
    }>;

    expect(seeded.map((r) => r.id)).toEqual(inputs.map((r) => r.id));
    for (const [i, input] of inputs.entries()) {
      // JSON 저장 시 undefined 값의 필드는 사라지므로 직렬화 동등성(toEqual)으로 비교한다.
      expect(seeded[i].derived).toEqual(computeDerivedRates(input));
    }
  });

  it("matches on reach-based and replay/watch-time fields the demo data lacks", () => {
    // examples/demo-data에는 replays/totalWatchTimeSec/totalInteractions가 없어
    // 해당 필드의 포팅 drift를 못 잡는다. 전부 포함한 합성 데이터로 보강한다.
    const srcTmp = mkdtempSync(join(tmpdir(), "seed-demo-src-"));
    try {
      const reel = {
        id: "parity-1",
        postedAt: "2026-07-01T00:00:00Z",
        durationSec: 30,
        views: 1000,
        reach: 800,
        likes: 50,
        comments: 5,
        saves: 20,
        shares: 10,
        avgWatchTimeSec: 12,
        totalInteractions: 120,
        totalWatchTimeSec: 9000,
        replays: 250,
        followsFromReel: 7,
        profileVisits: 40,
      };
      writeFileSync(join(srcTmp, "reels.json"), JSON.stringify([reel]));
      writeFileSync(join(srcTmp, "snapshots.json"), "[]");
      writeFileSync(
        join(srcTmp, "profile.json"),
        JSON.stringify({
          username: "parity.demo",
          followersCount: 1,
          mediaCount: 1,
          updatedAt: "2026-07-01T00:00:00Z",
        }),
      );

      const res = runSeed([], { DEMO_DATA_DIR: srcTmp });
      expect(res.status).toBe(0);

      const seeded = readJson(join(dataDirTmp, "reels.json")) as Array<{
        derived: Record<string, number>;
      }>;
      expect(seeded[0].derived).toEqual(computeDerivedRates(ReelSchema.parse(reel)));
      // 포팅 누락이 생기면 즉시 걸리도록 명시 단언도 둔다.
      expect(seeded[0].derived.commentRateByReach).toBeCloseTo(0.625);
      expect(seeded[0].derived.likeRateByReach).toBeCloseTo(6.25);
      expect(seeded[0].derived.replayRate).toBeCloseTo(25);
      expect(seeded[0].derived.watchTimePerView).toBeCloseTo(9);
    } finally {
      rmSync(srcTmp, { recursive: true, force: true });
    }
  });
});

describe("seed-demo overwrite guard", () => {
  it.each(["reels.json", "snapshots.json", "profile.json"])(
    "refuses to seed without --force when %s already has data",
    (name) => {
      const content = name === "profile.json" ? { username: "real.account" } : [{ id: "real-1" }];
      writeFileSync(join(dataDirTmp, name), JSON.stringify(content));

      const res = runSeed();
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(name);
      expect(res.stderr).toContain("--force");
      // 기존 파일이 유지됐는지
      expect(readJson(join(dataDirTmp, name))).toEqual(content);
    },
  );

  it("seeds when the files exist but are empty", () => {
    writeFileSync(join(dataDirTmp, "reels.json"), "[]");
    writeFileSync(join(dataDirTmp, "snapshots.json"), "[]");
    writeFileSync(join(dataDirTmp, "profile.json"), "{}");

    const res = runSeed();
    expect(res.status).toBe(0);
    expect((readJson(join(dataDirTmp, "reels.json")) as unknown[]).length).toBeGreaterThan(0);
  });

  it("--force writes a timestamped backup before overwriting", () => {
    const original = [{ id: "keep-me" }];
    writeFileSync(join(dataDirTmp, "reels.json"), JSON.stringify(original));

    const res = runSeed(["--force"]);
    expect(res.status).toBe(0);

    const backups = readdirSync(dataDirTmp).filter((f) =>
      /^reels\.json\.bak-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/.test(f),
    );
    expect(backups).toHaveLength(1);
    expect(readJson(join(dataDirTmp, backups[0]))).toEqual(original);

    const seeded = readJson(join(dataDirTmp, "reels.json")) as Array<{ id: string }>;
    expect(seeded[0].id).toBe("demo-founder-01");
  });
});
