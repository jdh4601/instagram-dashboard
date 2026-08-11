import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { getTextModel } from "@/lib/llm";
import { generateReelAnalysis } from "@/lib/recommend/reelAnalysis";
import { assertJsonRequest } from "@/lib/api/guard";

// 분석 탭 4개가 함께 쓰는 LLM 캐시를 만든다. 한 번 호출해 릴스에 담아 두고,
// 다시 부르면 덮어쓴다(사용자가 "다시 분석"을 누른 경우).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;

  const { id } = await params;
  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return NextResponse.json({ error: "릴스를 찾을 수 없습니다" }, { status: 404 });

  if (!reel.transcript || reel.transcript.length === 0) {
    return NextResponse.json(
      { error: "분석할 자막이 없습니다. 자동 전사를 돌리거나 SRT를 먼저 올려 주세요." },
      { status: 400 },
    );
  }

  try {
    const model = await getTextModel();
    const analysis = await generateReelAnalysis(reel, model);
    const reelAnalysis = { ...analysis, generatedAt: new Date().toISOString() };
    await repo.upsert({ ...reel, reelAnalysis });
    return NextResponse.json(reelAnalysis);
  } catch (err) {
    // 키 미설정·모델 오류·스키마 불일치를 구분 없이 삼키면 사용자가 고칠 방법을 모른다.
    const message = err instanceof Error ? err.message : "분석 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
