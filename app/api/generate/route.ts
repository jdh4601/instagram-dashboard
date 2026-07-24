import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/store";
import { analyzeReel } from "@/lib/analysis/analyze";
import { generateRecommendations } from "@/lib/recommend/generate";
import { getTextModel } from "@/lib/llm";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";

const BodySchema = z.object({ reelId: z.string().min(1) });

export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = BodySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const repo = getRepository();
  const reel = await repo.get(parsed.data.reelId);
  if (!reel) return NextResponse.json({ error: "릴스를 찾을 수 없습니다" }, { status: 404 });

  const history = (await repo.list())
    .filter((r) => r.id !== reel.id)
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  const { diagnosis, drops } = analyzeReel(reel, history);

  try {
    const model = await getTextModel();
    const generation = await generateRecommendations(reel, diagnosis, drops, model);
    return NextResponse.json(generation);
  } catch (err) {
    const message = err instanceof Error ? err.message : "생성 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
