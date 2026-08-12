import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { getTextModel } from "@/lib/llm";
import { generateImprovedStory } from "@/lib/recommend/improvedStory";
import { assertJsonRequest } from "@/lib/api/guard";

// 개선된 전개안은 분석 결과 위에 얹는다. 빠진 비트가 무엇인지 알아야 채울 수
// 있어서, 분석이 없으면 생성 자체가 성립하지 않는다.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;

  const { id } = await params;
  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return NextResponse.json({ error: "릴스를 찾을 수 없습니다" }, { status: 404 });

  if (!reel.reelAnalysis) {
    return NextResponse.json(
      { error: "먼저 분석을 돌려 주세요. 빠진 비트를 알아야 전개안을 만들 수 있습니다." },
      { status: 400 },
    );
  }

  try {
    const model = await getTextModel();
    const improved = await generateImprovedStory(reel, reel.reelAnalysis, model);
    const improvedStory = { ...improved, generatedAt: new Date().toISOString() };
    await repo.upsert({ ...reel, improvedStory });
    return NextResponse.json(improvedStory);
  } catch (err) {
    // 키 미설정·모델 오류·스키마 불일치를 구분 없이 삼키면 고칠 방법을 모른다.
    const message = err instanceof Error ? err.message : "전개안 생성 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
