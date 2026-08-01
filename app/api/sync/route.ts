import { NextResponse } from "next/server";
import {
  getRepository,
  getAccountRepository,
  getProfileRepository,
  getReelHistoryRepository,
  getApplicationRepository,
} from "@/lib/store";
import { getInstagramClient } from "@/lib/graph";
import { syncFromGraph, type SyncProgress } from "@/lib/graph/sync";
import { getWallaConnection } from "@/lib/walla";
import { syncApplicationsIfConfigured } from "@/lib/walla/sync";
import { assertJsonRequest } from "@/lib/api/guard";

const NDJSON = "application/x-ndjson";

async function runSync(onProgress?: (progress: SyncProgress) => void) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const client = await getInstagramClient();
  const result = await syncFromGraph(
    client,
    getRepository(),
    getAccountRepository(),
    today,
    getProfileRepository(),
    getReelHistoryRepository(),
    onProgress,
  );

  // 신청 폼은 선택 연동이라 실패해도 위 결과를 버리지 않는다. 사유는 errors에 실어
  // 다른 동기화 오류와 같은 자리에서 보이게 한다.
  const applications = await syncApplicationsIfConfigured(
    await getWallaConnection(),
    getApplicationRepository(),
  );

  return {
    ...result,
    applications: applications.applications,
    errors: applications.error ? [...result.errors, applications.error] : result.errors,
  };
}

// 게시물당 Graph 호출을 순차로 돌려 동기화는 수십 초가 걸린다. 진행률을 보여주려면
// 결과를 한 번에 주는 대신 게시물이 끝날 때마다 한 줄씩 흘려보내야 한다.
//
// 스트림은 본문을 쓰기 전에 헤더가 나가므로 상태 코드로 실패를 알릴 수 없다.
// 실패는 마지막 error 이벤트로 전달하고, 클라이언트가 502와 동등하게 다룬다.
function streamingSync(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const result = await runSync((progress) => send({ type: "progress", ...progress }));
        send({ type: "result", ...result });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "동기화 실패" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": `${NDJSON}; charset=utf-8`,
      "Cache-Control": "no-store, no-transform",
      // 중간 프록시가 버퍼링하면 진행률이 끝에 몰려 도착해 막대가 의미를 잃는다.
      "X-Accel-Buffering": "no",
    },
  });
}

async function bufferedSync(): Promise<Response> {
  try {
    const result = await runSync();
    // 일부 릴스 실패는 사용 가능한 데이터까지 반환하되 207로 명시한다.
    // 클라이언트는 failedReels/errors를 표시하고 성공분으로 화면을 갱신할 수 있다.
    return NextResponse.json(result, { status: result.failedReels > 0 ? 207 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "동기화 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  // 스트림을 요청하지 않은 호출자(크론 등)에게는 기존 단일 JSON 응답을 유지한다.
  const wantsStream = (req.headers.get("accept") ?? "").includes(NDJSON);
  return wantsStream ? streamingSync() : bufferedSync();
}
