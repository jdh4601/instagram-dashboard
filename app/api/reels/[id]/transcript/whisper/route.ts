import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { assertJsonRequest } from "@/lib/api/guard";
import { resolveTranscriptionCredentials } from "@/lib/llm/transcription";
import { transcribeVideoFile } from "@/lib/media/transcribe";
import { readCachedVideoStat } from "@/lib/media/videoCache";

/**
 * 자동 전사: 캐시된 mp4를 OpenAI 전사 API에 보내 `reel.transcript`를 채운다.
 *
 * 수동 SRT 업로드(../route.ts)와 나란히 있는 추가 경로다. 저장 구조가 같아서
 * 어느 쪽으로 들어와도 기존 분석이 그대로 돈다.
 *
 * 실패는 셋으로 갈라 안내한다 — 키 미설정(설정에서 고침) · 영상 없음(먼저 받기) ·
 * 전사 실패(다시 시도). 하나로 뭉치면 사용자가 무엇을 해야 할지 알 수 없다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  const { id } = await params;

  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return NextResponse.json({ error: "게시물을 찾을 수 없습니다" }, { status: 404 });

  const credentials = await resolveTranscriptionCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: "OpenAI API 키가 없습니다. 대시보드 설정(/settings)에서 OpenAI 키를 추가하세요." },
      { status: 400 },
    );
  }

  const { dataDir } = resolveRuntimeConfig();
  let cached: Awaited<ReturnType<typeof readCachedVideoStat>>;
  try {
    cached = await readCachedVideoStat(dataDir, id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "영상 경로를 만들 수 없습니다";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (!cached) {
    return NextResponse.json(
      { error: "내려받은 영상이 없습니다. '영상 받기'로 mp4를 먼저 받아 주세요." },
      { status: 404 },
    );
  }

  try {
    const transcript = await transcribeVideoFile(cached.path, credentials);
    await repo.upsert({ ...reel, transcript });
    return NextResponse.json({ ok: true, lineCount: transcript.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "전사에 실패했습니다";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
