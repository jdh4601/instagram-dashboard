// cron/daily-report 라우트 인증 테스트. 다운스트림(리포트 생성/발송)은 mock으로
// 대체해 side effect 없이 secretMatches 동작만 검증한다.
jest.mock("@/lib/email/sendReport", () => ({
  createReportSender: jest.fn(() => jest.fn()),
}));
jest.mock("@/lib/report/generateAndSendDailyReport", () => ({
  generateAndSendDailyReport: jest.fn(),
}));

import { POST } from "@/app/api/cron/daily-report/route";
import { generateAndSendDailyReport } from "@/lib/report/generateAndSendDailyReport";

const mockGenerate = generateAndSendDailyReport as unknown as jest.Mock;

const SECRET = "test-cron-secret";

function cronRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/cron/daily-report", {
    method: "POST",
    headers: { host: "localhost:3000", ...headers },
  });
}

describe("POST /api/cron/daily-report 인증", () => {
  const prevSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      date: "2026-07-23",
      metrics: { followerCount: 100, followerDelta: 2, reelsAnalyzed: 3 },
    });
  });

  afterAll(() => {
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  });

  test("시크릿 헤더가 없으면 401", async () => {
    const res = await POST(cronRequest());
    expect(res.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test("시크릿이 틀리면 401 (길이 다름)", async () => {
    const res = await POST(cronRequest({ "x-cron-secret": "wrong" }));
    expect(res.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test("시크릿이 틀리면 401 (길이 같음, 타이밍 세이프 비교 경로)", async () => {
    const res = await POST(cronRequest({ "x-cron-secret": "test-cron-secreX" }));
    expect(res.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test("시크릿이 맞으면 리포트 생성으로 진행한다", async () => {
    const res = await POST(cronRequest({ "x-cron-secret": SECRET }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.date).toBe("2026-07-23");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test("CRON_SECRET 미설정이면 500", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(cronRequest({ "x-cron-secret": SECRET }));
    expect(res.status).toBe(500);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
