import { NextResponse } from "next/server";
import { getRepository, getReelHistoryRepository } from "@/lib/store";
import { analyzeReel } from "@/lib/analysis/analyze";
import { reelKpiDeltas } from "@/lib/analysis/reelKpiDeltas";
import { adjacentReelIds } from "@/lib/analysis/reelNavigation";
import { mediaKindOf } from "@/lib/media/kind";

// 게시물 상세: reel + 분석 결과 + 지표 이력
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return NextResponse.json({ error: "게시물을 찾을 수 없습니다" }, { status: 404 });

  // 캐러셀 기준선이 릴스 중앙값으로 오염되지 않도록, 그리고 목록에서 보던
  // 종류와 다른 게시물로 이동하지 않도록 같은 미디어 종류끼리만 비교한다.
  const kind = mediaKindOf(reel);
  const sameKind = (await repo.list()).filter((candidate) => mediaKindOf(candidate) === kind);
  const history = sameKind
    .filter((r) => r.id !== reel.id)
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  const analysis = analyzeReel(reel, history);
  const metricHistory = await getReelHistoryRepository().list(id);
  const kpiDeltas = reelKpiDeltas(reel, history);
  const nav = adjacentReelIds(sameKind, reel.id);

  return NextResponse.json({ reel, analysis, metricHistory, kpiDeltas, nav });
}
