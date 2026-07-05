import { buildDailyReport } from "@/lib/report/buildDailyReport";
import type { Reel, AccountSnapshot } from "@/lib/schemas";

function reel(p: Partial<Reel> & { id: string }): Reel {
  return {
    // 기본값: 리포트 날짜(2026-07-05) 기준 최근 1달 창(cutoff 2026-06-05) 안쪽
    postedAt: "2026-06-25T00:00:00+0000",
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

test("베스트 1위는 조회수 1위임을 선정 이유로 표시", () => {
  const report = buildDailyReport(reels, snapshots, "2026-07-05", { topN: 1 });
  expect(report.best[0].reason).toContain("1위");
});

test("워스트 최하위는 조회수 최저임을 선정 이유로 표시", () => {
  const report = buildDailyReport(reels, snapshots, "2026-07-05", { topN: 1 });
  expect(report.worst[0].reason).toContain("최저");
});

test("선정 이유에 참여율의 평균 대비 위치를 반영", () => {
  // 참여율: top 5.56% > 평균(3.05%) > low 1.2%
  const report = buildDailyReport(reels, snapshots, "2026-07-05", { topN: 3 });
  expect(report.best[0].reason).toContain("평균 이상");
  expect(report.worst[0].reason).toContain("평균 이하");
});

test("최근 1달(30일) 이내 업로드된 릴스만 분석 대상에 포함", () => {
  const mixed: Reel[] = [
    reel({ id: "recent", postedAt: "2026-07-01T00:00:00+0000", views: 500, reach: 400 }),
    reel({ id: "old", postedAt: "2026-05-20T00:00:00+0000", views: 9999, reach: 9000 }),
  ];
  const report = buildDailyReport(mixed, snapshots, "2026-07-05");
  expect(report.metrics.reelsAnalyzed).toBe(1);
  expect(report.best.map((r) => r.id)).toEqual(["recent"]);
  expect(report.worst.map((r) => r.id)).toEqual(["recent"]);
  expect(report.diagnosis.reelCount).toBe(1);
});

test("경계: 정확히 30일 전(cutoff) 릴스는 포함한다", () => {
  // 2026-07-05 − 30일 = 2026-06-05
  const edge: Reel[] = [reel({ id: "edge", postedAt: "2026-06-05T12:00:00+0000", views: 1 })];
  const report = buildDailyReport(edge, snapshots, "2026-07-05");
  expect(report.metrics.reelsAnalyzed).toBe(1);
});

test("경계: 30일보다 하루 더 오래된 릴스는 제외한다", () => {
  const stale: Reel[] = [reel({ id: "stale", postedAt: "2026-06-04T12:00:00+0000", views: 1 })];
  const report = buildDailyReport(stale, snapshots, "2026-07-05");
  expect(report.metrics.reelsAnalyzed).toBe(0);
});

test("windowDays 옵션으로 분석 창을 조절할 수 있다", () => {
  const mixed: Reel[] = [
    reel({ id: "d10", postedAt: "2026-06-28T00:00:00+0000", views: 1 }),
    reel({ id: "d40", postedAt: "2026-05-26T00:00:00+0000", views: 1 }),
  ];
  const report = buildDailyReport(mixed, snapshots, "2026-07-05", { windowDays: 60 });
  expect(report.metrics.reelsAnalyzed).toBe(2);
});
