import { NextResponse } from "next/server";
import { getRepository, getReelHistoryRepository } from "@/lib/store";
import { ReelSchema } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { buildAgeNormalizedMap } from "@/lib/analysis/ageNormalized";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";

export async function GET() {
  const reels = await getRepository().list();
  // 경과일이 다른 게시물을 공정하게 견주려면 목록에도 초기 조회수가 필요하다.
  const history = await getReelHistoryRepository().listAll();
  return NextResponse.json({ reels, earlyViews: buildAgeNormalizedMap(reels, history) });
}

export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = ReelSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const reel = { ...parsed.data, derived: computeDerivedRates(parsed.data) };
  const saved = await getRepository().upsert(reel);
  return NextResponse.json({ reel: saved });
}
