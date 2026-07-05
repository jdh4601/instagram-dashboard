import { buildDailyReport } from "@/lib/report/buildDailyReport";
import type { Reel, AccountSnapshot } from "@/lib/schemas";

function reel(p: Partial<Reel> & { id: string }): Reel {
  return {
    postedAt: "2026-06-01T00:00:00+0000",
    durationSec: 0,
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 0,
    ...p,
  };
}

const snapshots: AccountSnapshot[] = [
  { date: "2026-07-03", followerCount: 240, reachLast7d: 1000 },
  { date: "2026-07-04", followerCount: 252, reachLast7d: 1500 },
];

const reels: Reel[] = [
  reel({ id: "top", views: 9000, reach: 8000, likes: 400, comments: 20, saves: 30, shares: 50 }),
  reel({ id: "mid", views: 5000, reach: 4000, likes: 100, comments: 5, saves: 10, shares: 5 }),
  reel({ id: "low", views: 1000, reach: 900, likes: 10, comments: 1, saves: 1, shares: 0 }),
];

test("핵심 지표 요약: 최신 팔로워 수·전일 대비 증감·도달·분석 릴스 수", () => {
  const report = buildDailyReport(reels, snapshots, "2026-07-05");
  expect(report.date).toBe("2026-07-05");
  expect(report.metrics.followerCount).toBe(252);
  expect(report.metrics.followerDelta).toBe(12);
  expect(report.metrics.reachLast7d).toBe(1500);
  expect(report.metrics.reelsAnalyzed).toBe(3);
});

test("스냅샷이 1개뿐이면 팔로워 증감은 null", () => {
  const report = buildDailyReport(reels, snapshots.slice(0, 1), "2026-07-05");
  expect(report.metrics.followerDelta).toBeNull();
});

test("베스트/워스트: 조회수 상위·하위 릴스를 topN 만큼 반환", () => {
  const report = buildDailyReport(reels, snapshots, "2026-07-05", { topN: 2 });
  expect(report.best.map((r) => r.id)).toEqual(["top", "mid"]);
  expect(report.worst.map((r) => r.id)).toEqual(["low", "mid"]);
});

test("하이라이트에 참여율(engagementRate)이 계산되어 포함", () => {
  const report = buildDailyReport(reels, snapshots, "2026-07-05", { topN: 1 });
  // 앱 규약: engagementRate = (likes+comments+saves+shares) / views * 100
  // = (400+20+30+50)/9000*100 = 5.5556
  expect(report.best[0].engagementRate).toBeCloseTo(5.5556, 3);
});

test("심층 진단(diagnoseRecent) 결과를 포함", () => {
  const report = buildDailyReport(reels, snapshots, "2026-07-05");
  expect(report.diagnosis.reelCount).toBe(3);
  expect(typeof report.diagnosis.summary).toBe("string");
});
