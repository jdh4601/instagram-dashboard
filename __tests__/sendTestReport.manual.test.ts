/**
 * 수동 발송 테스트 — Resend로 실제 이메일을 보낸다.
 *
 * 평소 `npm test`에서는 SKIP되고, 아래처럼 명시적으로 켤 때만 실행된다:
 *
 *   SEND_TEST_REPORT=1 npx vitest run sendTestReport
 *
 * 동기화(lib/graph)는 건너뛰고 기존 data/*.json으로 리포트를 만들어
 * .env의 RESEND_* 설정으로 발송한다. (이메일 경로만 검증)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDailyReport } from "@/lib/report/buildDailyReport";
import { renderReportHtml } from "@/lib/report/renderReportHtml";
import { createReportSender } from "@/lib/email/sendReport";
import type { Reel, AccountSnapshot } from "@/lib/schemas";

// dotenv 미설치 → .env를 직접 파싱해 process.env에 주입 (기존 값은 유지)
function loadEnv(): void {
  const text = readFileSync(join(process.cwd(), ".env"), "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
}

const shouldRun = process.env.SEND_TEST_REPORT === "1";

(shouldRun ? test : test.skip)(
  "Resend로 리포트 이메일을 실제 발송한다",
  async () => {
    loadEnv();

    const dataDir = join(process.cwd(), "data");
    const reels: Reel[] = JSON.parse(readFileSync(join(dataDir, "reels.json"), "utf8"));
    const snapshots: AccountSnapshot[] = JSON.parse(
      readFileSync(join(dataDir, "snapshots.json"), "utf8"),
    );

    const today = new Date().toISOString().slice(0, 10);
    const report = buildDailyReport(reels, snapshots, today);
    const html = renderReportHtml(report);

    const send = createReportSender({
      apiKey: process.env.RESEND_API_KEY,
      // 도메인 인증 전 테스트용 기본 발신지 (수신자는 Resend 가입 이메일이어야 함)
      from: process.env.REPORT_EMAIL_FROM || "onboarding@resend.dev",
      to: process.env.REPORT_EMAIL_TO,
    });

    await send({ subject: `[테스트] 인스타 일일 리포트 ${today}`, html });
    console.log(`✅ 발송 완료 → ${process.env.REPORT_EMAIL_TO}`);
  },
  30_000,
);
