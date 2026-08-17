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
import { getSettingsStore } from "@/lib/settings";
import { fetchAdPerformance } from "@/lib/ads/cache";

const NDJSON = "application/x-ndjson";

interface AdsSyncResult {
  ads: { configured: boolean; count: number };
  error: string | null;
}

/**
 * 광고 성과를 캐시를 건너뛰고 다시 받는다.
 *
 * 동기화 버튼의 뜻은 "지금 상태를 다시 가져와라"이므로 force로 부른다. 성과 자체는
 * 저장하지 않는다 — 외부 집계라 사본을 두면 광고 관리자와 어긋나는 순간이 생긴다.
 * 여기서 하는 일은 최신 값을 한 번 당겨 캐시를 데우고, 몇 건이 잡혔는지 알리는 것뿐이다.
 */
async function refreshAds(): Promise<AdsSyncResult> {
  try {
    const result = await fetchAdPerformance({ force: true });
    return {
      ads: { configured: result.configured, count: result.performance.length },
      error: result.error,
    };
  } catch {
    // 곁다리 연동이 릴스·계정 지표를 끌어내리게 두지 않는다. 신청 폼과 같은 취급이다.
    // 다만 사유는 반드시 남긴다 — 조용히 "미연동"으로 두면 붙인 적 없는 상태와
    // 구분되지 않아, 끊긴 연동을 아무도 눈치채지 못한다.
    return { ads: { configured: false, count: 0 }, error: "광고 연동을 확인하지 못했습니다" };
  }
}

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

  // 광고도 마찬가지로 선택 연동이다. 안 붙인 사용자에게는 조용히 0건으로 남는다.
  const ads = await refreshAds();

  // 여기까지 왔다면 저장소에 새 데이터가 실제로 들어갔다. 위에서 예외가 나면
  // 시각을 남기지 않아, 실패한 동기화가 화면을 신선하다고 속이지 못한다.
  await getSettingsStore().markSynced(new Date().toISOString());

  const errors = [...result.errors];
  if (applications.error) errors.push(applications.error);
  if (ads.error) errors.push(ads.error);

  return {
    ...result,
    applications: applications.applications,
    ads: ads.ads,
    errors,
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
