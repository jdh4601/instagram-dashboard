import { Resend } from "resend";
import type { DailyReportEmail } from "@/lib/report/generateAndSendDailyReport";

export interface ResendSendResult {
  data: { id: string } | null;
  error: { message: string } | null;
}

export interface ResendClientLike {
  emails: {
    send: (args: {
      from: string;
      to: string | string[];
      subject: string;
      html: string;
    }) => Promise<ResendSendResult>;
  };
}

export interface ReportSenderConfig {
  apiKey?: string;
  from?: string;
  to?: string;
  /** 테스트 주입용. 없으면 apiKey로 Resend 클라이언트를 생성 */
  client?: ResendClientLike;
}

function parseRecipients(to: string): string | string[] {
  const list = to
    .split(",")
    .map((addr) => addr.trim())
    .filter((addr) => addr.length > 0);
  return list.length === 1 ? list[0] : list;
}

export function createReportSender(
  config: ReportSenderConfig,
): (email: DailyReportEmail) => Promise<void> {
  const from = config.from?.trim();
  const to = config.to?.trim();
  if (!from) throw new Error("리포트 발신 주소(REPORT_EMAIL_FROM)가 설정되지 않았습니다.");
  if (!to) throw new Error("리포트 수신 주소(REPORT_EMAIL_TO)가 설정되지 않았습니다.");

  const client = config.client ?? resolveClient(config.apiKey);
  const recipients = parseRecipients(to);

  return async ({ subject, html }) => {
    const { error } = await client.emails.send({ from, to: recipients, subject, html });
    if (error) {
      throw new Error(`이메일 발송 실패: ${error.message}`);
    }
  };
}

function resolveClient(apiKey?: string): ResendClientLike {
  const key = apiKey?.trim();
  if (!key) throw new Error("RESEND_API_KEY가 설정되지 않았습니다.");
  return new Resend(key);
}
