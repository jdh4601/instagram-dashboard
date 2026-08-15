import { NextResponse } from "next/server";
import { assertJsonRequest } from "@/lib/api/guard";
import { getHookRepository } from "@/lib/store";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { getVisionModel } from "@/lib/llm";
import { resolveTranscriptionCredentials } from "@/lib/llm/transcription";
import { normalizeInstagramReelUrl, runReelBreakdown } from "@/lib/reelBreakdown/pipeline";
import { removeReelBreakdownAssets } from "@/lib/reelBreakdown/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const activeHookBreakdowns = new Set<string>();

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * 다운로드·전사·비전 분석·클립 인코딩은 수분 걸릴 수 있어 NDJSON으로 진행 단계를 보낸다.
 * 헤더가 나간 뒤의 실패는 HTTP 상태를 바꿀 수 없으므로 마지막 error 이벤트가 맡는다.
 */
export async function POST(req: Request, { params }: Context): Promise<Response> {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  const id = (await params).id;
  const repo = getHookRepository();
  const hook = await repo.get(id);
  if (!hook) return NextResponse.json({ error: "훅을 찾을 수 없습니다" }, { status: 404 });
  if (!hook.sourceUrl) {
    return NextResponse.json({ error: "원본 링크가 있는 훅만 해체할 수 있습니다" }, { status: 400 });
  }

  const runtimeConfig = resolveRuntimeConfig();
  if (!runtimeConfig.isLocalRuntime) {
    return NextResponse.json(
      { error: "릴스 해체는 yt-dlp와 ffmpeg를 실행할 수 있는 로컬 대시보드에서만 지원합니다" },
      { status: 400 },
    );
  }
  try {
    normalizeInstagramReelUrl(hook.sourceUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "원본 링크가 올바르지 않습니다" },
      { status: 400 },
    );
  }
  if (activeHookBreakdowns.has(id)) {
    return NextResponse.json({ error: "이 릴스는 이미 해체 중입니다" }, { status: 409 });
  }
  // 키·모델을 읽는 동안 다른 탭이 같은 훅을 시작하지 못하게 이 지점에서 선점한다.
  activeHookBreakdowns.add(id);

  let transcription;
  try {
    transcription = await resolveTranscriptionCredentials();
  } catch (error) {
    activeHookBreakdowns.delete(id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "전사 설정을 읽지 못했습니다" },
      { status: 400 },
    );
  }
  if (!transcription) {
    activeHookBreakdowns.delete(id);
    return NextResponse.json(
      { error: "음성 전사용 OpenAI API 키가 없습니다. 설정에서 OpenAI 키를 추가하세요." },
      { status: 400 },
    );
  }

  let visionModel;
  try {
    visionModel = await getVisionModel();
  } catch (error) {
    activeHookBreakdowns.delete(id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이미지 분석 모델을 준비하지 못했습니다" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  let connected = true;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        if (!connected) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // 화면을 떠나도 로컬 작업과 저장은 끝낸다. 끊긴 스트림에 다시 쓰지만 않는다.
          connected = false;
        }
      };
      let createdAssetKey: string | null = null;
      let stored = false;
      try {
        const breakdown = await runReelBreakdown({
          hook,
          dataDir: runtimeConfig.dataDir,
          transcription,
          visionModel,
          onProgress: (progress) => send({ type: "progress", ...progress }),
        });
        createdAssetKey = breakdown.assetKey;
        // 작업 중 하트·메모를 바꿨을 수 있으므로 시작 시점의 hook을 그대로 덮어쓰지 않는다.
        const latest = await repo.get(id);
        if (!latest) throw new Error("해체 중 훅이 삭제되어 결과를 저장하지 못했습니다");
        const previousAssetKey = latest.breakdown?.assetKey;
        await repo.upsert({ ...latest, breakdown, updatedAt: new Date().toISOString() });
        stored = true;
        if (previousAssetKey && previousAssetKey !== breakdown.assetKey) {
          removeReelBreakdownAssets(runtimeConfig.dataDir, previousAssetKey).catch((error) =>
            console.warn("[reel-breakdown] 이전 asset 정리 실패", error),
          );
        }
        send({ type: "result", breakdown });
      } catch (error) {
        if (createdAssetKey && !stored) {
          await removeReelBreakdownAssets(runtimeConfig.dataDir, createdAssetKey).catch(() => {});
        }
        send({
          type: "error",
          error: error instanceof Error ? error.message : "릴스 해체에 실패했습니다",
        });
      } finally {
        activeHookBreakdowns.delete(id);
        if (connected) controller.close();
      }
    },
    cancel() {
      connected = false;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
