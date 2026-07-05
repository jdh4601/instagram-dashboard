import type { Reel, AccountSnapshot } from "@/lib/schemas";
import { buildDailyReport, type DailyReport, type BuildDailyReportOptions } from "@/lib/report/buildDailyReport";
import { renderReportHtml } from "@/lib/report/renderReportHtml";

export interface DailyReportEmail {
  subject: string;
  html: string;
}

export interface DailyReportDeps {
  /** Graph API에서 최신 데이터 동기화 (data/*.json 갱신) */
  sync: () => Promise<void>;
  loadReels: () => Promise<Reel[]>;
  loadSnapshots: () => Promise<AccountSnapshot[]>;
  send: (email: DailyReportEmail) => Promise<void>;
  /** 오늘 날짜 YYYY-MM-DD (테스트 주입용) */
  today: () => string;
  options?: BuildDailyReportOptions;
}

function buildSubject(report: DailyReport): string {
  const { followerCount, followerDelta } = report.metrics;
  const delta =
    followerDelta === null ? "" : ` (${followerDelta > 0 ? "+" : ""}${followerDelta})`;
  return `[인스타 리포트] ${report.date} · 팔로워 ${followerCount.toLocaleString()}${delta}`;
}

export async function generateAndSendDailyReport(deps: DailyReportDeps): Promise<DailyReport> {
  // 동기화가 실패하면 이후 단계를 진행하지 않고 에러 전파 (오래된 데이터로 리포트 방지)
  await deps.sync();

  const [reels, snapshots] = await Promise.all([deps.loadReels(), deps.loadSnapshots()]);
  const report = buildDailyReport(reels, snapshots, deps.today(), deps.options);

  await deps.send({ subject: buildSubject(report), html: renderReportHtml(report) });
  return report;
}
