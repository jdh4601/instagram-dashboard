// cron/daily-report 라우트 인증 테스트. 다운스트림(리포트 생성/발송)은 mock으로
// 대체해 side effect 없이 secretMatches 동작만 검증한다.
vi.mock("@/lib/email/sendReport", () => ({
  createReportSender: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/report/generateAndSendDailyReport", () => ({
  generateAndSendDailyReport: vi.fn(),
}));
// 실제 설정 파일을 읽거나 Meta에 요청하지 않도록 토큰 갱신도 대역으로 바꾼다.
vi.mock("@/lib/instagram/tokenRefresh", () => ({
  refreshInstagramTokenIfDue: vi.fn(async () => ({ status: "skipped", reason: "not-due" })),
}));

import { GET, POST } from "@/app/api/cron/daily-report/route";
import { generateAndSendDailyReport } from "@/lib/report/generateAndSendDailyReport";
import { refreshInstagramTokenIfDue } from "@/lib/instagram/tokenRefresh";

const mockGenerate = generateAndSendDailyReport as unknown as Mock;

const SECRET = "test-cron-secret";

function cronRequest(headers: Record<string, string> = {}, method = "POST"): Request {
  return new Request("http://localhost:3000/api/cron/daily-report", {
    method,
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

  // 만료 전에 토큰을 늘려 두는 것이 이 크론의 두 번째 임무다.
  test("리포트를 만들기 전에 토큰 갱신을 먼저 시도한다", async () => {
    const mockRefresh = refreshInstagramTokenIfDue as unknown as Mock;
    mockRefresh.mockClear();

    const res = await POST(cronRequest({ "x-cron-secret": SECRET }));

    expect(res.status).toBe(200);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh.mock.invocationCallOrder[0]).toBeLessThan(
      mockGenerate.mock.invocationCallOrder[0],
    );
    expect(await res.json()).toHaveProperty("tokenRefresh.status", "skipped");
  });

  test("CRON_SECRET 미설정이면 500", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(cronRequest({ "x-cron-secret": SECRET }));
    expect(res.status).toBe(500);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

// Vercel Cron은 GET으로 호출하며, CRON_SECRET 환경변수가 설정돼 있으면
// Authorization: Bearer 헤더로 시크릿을 자동으로 실어 보낸다.
describe("GET /api/cron/daily-report (Vercel Cron)", () => {
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

  test("Authorization: Bearer 시크릿이 맞으면 리포트 생성으로 진행한다", async () => {
    const res = await GET(cronRequest({ authorization: `Bearer ${SECRET}` }, "GET"));
    expect(res.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test("Authorization: Bearer 시크릿이 틀리면 401", async () => {
    const res = await GET(cronRequest({ authorization: "Bearer wrong" }, "GET"));
    expect(res.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test("Authorization 헤더가 없으면 401", async () => {
    const res = await GET(cronRequest({}, "GET"));
    expect(res.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test("x-cron-secret 헤더로도 GET 호출이 통과한다(로컬 curl 테스트 호환)", async () => {
    const res = await GET(cronRequest({ "x-cron-secret": SECRET }, "GET"));
    expect(res.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
import type { Mock } from "vitest";
