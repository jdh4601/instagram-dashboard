import { NextResponse } from "next/server";
import {
  getRepository,
  getAccountRepository,
  getProfileRepository,
  getReelHistoryRepository,
} from "@/lib/store";
import { getInstagramClient } from "@/lib/graph";
import { syncFromGraph } from "@/lib/graph/sync";
import { assertJsonRequest } from "@/lib/api/guard";

export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  try {
    const client = await getInstagramClient();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const result = await syncFromGraph(
      client,
      getRepository(),
      getAccountRepository(),
      today,
      getProfileRepository(),
      getReelHistoryRepository(),
    );
    // 일부 릴스 실패는 사용 가능한 데이터까지 반환하되 207로 명시한다.
    // 클라이언트는 failedReels/errors를 표시하고 성공분으로 화면을 갱신할 수 있다.
    return NextResponse.json(result, { status: result.failedReels > 0 ? 207 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "동기화 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
