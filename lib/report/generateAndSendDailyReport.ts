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
  /** LLM 총평 생성(선택). 실패해도 정량 리포트는 발송된다 */
  generateNarrative?: (report: DailyReport) => Promise<string>;
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
  let report = buildDailyReport(reels, snapshots, deps.today(), deps.options);

  if (deps.generateNarrative) {
    try {
      const narrative = await deps.generateNarrative(report);
      report = { ...report, narrative };
    } catch (err) {
      // 총평(LLM) 생성 실패는 리포트 발송을 막지 않는다 — 정량 리포트는 여전히 유효하다.
      console.error("[daily-report] LLM 총평 생성 실패, 총평 없이 발송합니다:", err);
    }
  }

  await deps.send({ subject: buildSubject(report), html: renderReportHtml(report) });
  return report;
}
