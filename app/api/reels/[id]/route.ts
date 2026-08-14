import { NextResponse } from "next/server";
import { getRepository, getReelHistoryRepository } from "@/lib/store";
import { analyzeReel } from "@/lib/analysis/analyze";
import { reelKpiDeltas } from "@/lib/analysis/reelKpiDeltas";
import { mediaKindOf } from "@/lib/media/kind";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { assertJsonRequest } from "@/lib/api/guard";

// 게시물 상세: reel + 분석 결과 + 지표 이력
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return NextResponse.json({ error: "게시물을 찾을 수 없습니다" }, { status: 404 });

  // 캐러셀 기준선이 릴스 중앙값으로 오염되지 않도록 같은 미디어 종류끼리만 비교한다.
  const kind = mediaKindOf(reel);
  const history = (await repo.list())
    .filter((candidate) => mediaKindOf(candidate) === kind && candidate.id !== reel.id)
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  const analysis = analyzeReel(reel, history);
  const metricHistory = await getReelHistoryRepository().list(id);
  const kpiDeltas = reelKpiDeltas(reel, history);

  return NextResponse.json({ reel, analysis, metricHistory, kpiDeltas });
}

// 릴스 한 편이 넘길 수 없는 길이. 오타(150000)를 걸러낸다.
const MAX_DURATION_SEC = 900;

// 영상 길이 수동 입력. Graph API가 길이를 주지 않아(lib/graph/map.ts) 완료율이
// 계산되지 않는다. 길이가 채워지면 completionRate가 진단에 합류한다.
// 동기화는 mergeWithExisting에서 기존 durationSec을 우선하므로 덮어쓰지 않는다.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다" }, { status: 400 });
  }

  const durationSec = (body as { durationSec?: unknown })?.durationSec;
  if (
    typeof durationSec !== "number" ||
    !Number.isFinite(durationSec) ||
    durationSec <= 0 ||
    durationSec > MAX_DURATION_SEC
  ) {
    return NextResponse.json(
      { error: `영상 길이는 1~${MAX_DURATION_SEC}초 사이의 숫자여야 합니다` },
      { status: 400 },
    );
  }

  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return NextResponse.json({ error: "게시물을 찾을 수 없습니다" }, { status: 404 });

  // 길이 외 다른 필드는 요청에서 받지 않는다. 저장된 값만 신뢰한다.
  const next = { ...reel, durationSec };
  await repo.upsert({ ...next, derived: computeDerivedRates(next) });

  return NextResponse.json({ ok: true, durationSec });
}
