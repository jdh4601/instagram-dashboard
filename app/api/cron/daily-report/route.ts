import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getRepository,
  getAccountRepository,
  getProfileRepository,
  getReelHistoryRepository,
} from "@/lib/store";
import { getInstagramClient } from "@/lib/graph";
import { syncFromGraph } from "@/lib/graph/sync";
import { generateAndSendDailyReport } from "@/lib/report/generateAndSendDailyReport";
import { createReportSender } from "@/lib/email/sendReport";
import { buildNarrativePrompt } from "@/lib/report/narrativePrompt";
import { getTextModel } from "@/lib/llm";
import { assertJsonRequest } from "@/lib/api/guard";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// 타이밍 공격을 피하기 위해 상수 시간 비교를 사용한다.
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function handle(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET이 설정되지 않았습니다." },
      { status: 500 },
    );
  }
  if (!secretMatches(request.headers.get("x-cron-secret"), secret)) {
    return unauthorized();
  }

  try {
    const send = createReportSender({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.REPORT_EMAIL_FROM,
      to: process.env.REPORT_EMAIL_TO,
    });

    const report = await generateAndSendDailyReport({
      sync: async () => {
        const client = await getInstagramClient();
        await syncFromGraph(
          client,
          getRepository(),
          getAccountRepository(),
          today(),
          getProfileRepository(),
          getReelHistoryRepository(),
        );
      },
      loadReels: () => getRepository().list(),
      loadSnapshots: () => getAccountRepository().list(),
      send,
      today,
      generateNarrative: async (report) => {
        const model = await getTextModel();
        const { system, userText } = buildNarrativePrompt(report);
        return (await model.generate({ system, userText })).trim();
      },
    });

    return NextResponse.json({
      ok: true,
      date: report.date,
      followerCount: report.metrics.followerCount,
      followerDelta: report.metrics.followerDelta,
      reelsAnalyzed: report.metrics.reelsAnalyzed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "일일 리포트 생성 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const blocked = assertJsonRequest(request);
  if (blocked) return blocked;
  return handle(request);
}
