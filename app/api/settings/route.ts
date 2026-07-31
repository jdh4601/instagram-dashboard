import { NextResponse } from "next/server";
import { getSettingsStore } from "@/lib/settings";
import { SettingsInputSchema } from "@/lib/settings/store";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";
import { getInstagramOAuthStatus } from "@/lib/instagram/oauth";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { detectAvailableClis } from "@/lib/llm/chat/cliDetect";

async function publicSettings() {
  const masked = await getSettingsStore().masked();
  const environmentToken = Boolean(process.env.INSTAGRAM_ACCESS_TOKEN?.trim());
  const isLocal = resolveRuntimeConfig().isLocalRuntime;
  return {
    ...masked,
    instagram: environmentToken
      ? { configured: true, maskedKey: null, managedByEnvironment: true }
      : masked.instagram,
    instagramOAuth: getInstagramOAuthStatus(),
    // 자식 프로세스를 띄울 수 없는 배포에서는 CLI를 탐지하지도 않는다.
    chat: {
      localRuntime: isLocal,
      cli: isLocal
        ? await detectAvailableClis()
        : { "claude-cli": false, "codex-cli": false, "gemini-cli": false },
    },
  };
}

// GET: 마스킹된 설정만 반환 (실제 키는 절대 클라이언트로 내보내지 않음)
export async function GET() {
  return NextResponse.json(await publicSettings(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

// POST: 부분 업데이트 (apiKey 비우면 기존 키 유지). 마스킹된 결과 반환.
export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = SettingsInputSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const store = getSettingsStore();
  await store.save(parsed.data);
  return NextResponse.json(await publicSettings(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
