import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { getTextModel } from "@/lib/llm";
import { generateTranscriptInsights } from "@/lib/recommend/transcriptInsights";
import { assertJsonRequest } from "@/lib/api/guard";

// LLM 자막 심층 분석: 자막 + 지표를 모델에 보내 잘된 점/아쉬운 점 원인을 받아 릴스에 캐시.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  const { id } = await params;
  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return NextResponse.json({ error: "릴스를 찾을 수 없습니다" }, { status: 404 });

  if (!reel.transcript || reel.transcript.length === 0) {
    return NextResponse.json({ error: "분석할 자막이 없습니다. SRT를 먼저 업로드하세요." }, { status: 400 });
  }

  try {
    const model = await getTextModel();
    const result = await generateTranscriptInsights(reel, model);
    const transcriptInsights = { ...result, generatedAt: new Date().toISOString() };
    await repo.upsert({ ...reel, transcriptInsights });
    return NextResponse.json(transcriptInsights);
  } catch (err) {
    const message = err instanceof Error ? err.message : "분석 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
