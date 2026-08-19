import { NextResponse } from "next/server";
import { z } from "zod";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";
import { notFoundIfRemote } from "@/lib/chat/routeGuard";
import { buildChatProviderOptions } from "@/lib/chat/providerOptions";
import { detectAvailableClis } from "@/lib/llm/chat/cliDetect";
import { isCliProvider, type ChatProviderId } from "@/lib/llm/cliProviders";
import { PROVIDER_IDS, type ProviderId } from "@/lib/llm/providers";
import { getChatModel } from "@/lib/llm/chat";
import { getSettingsStore } from "@/lib/settings";

const BodySchema = z.object({
  provider: z.enum([
    "anthropic",
    "openai",
    "kimi",
    "gemini",
    "claude-cli",
    "codex-cli",
    "gemini-cli",
  ]),
  /** 빈 문자열은 "CLI 기본 모델로 되돌림"이라는 뜻이라 undefined와 구분한다. */
  model: z.string().optional(),
});

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * 진단 패널에서 제공자·모델을 바꾼다.
 *
 * 저장 전에 두 가지를 확인한다 — 지금 쓸 수 있는 제공자인지, 그리고 모델이 프리셋
 * 목록에 있는 이름인지. 특히 모델은 CLI 인자로 나가므로, 목록 밖 문자열을 그대로
 * 저장하면 설정 파일이 곧 인자 주입 통로가 된다.
 */
export async function POST(req: Request) {
  const blocked = notFoundIfRemote() ?? assertJsonRequest(req);
  if (blocked) return blocked;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = BodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest("제공자를 알 수 없습니다");

  const { provider, model } = parsed.data;
  const store = getSettingsStore();
  const masked = await store.masked();
  const options = buildChatProviderOptions({
    cli: await detectAvailableClis(),
    configured: Object.fromEntries(
      PROVIDER_IDS.map((id) => [id, masked.providers[id].configured]),
    ) as Record<ProviderId, boolean>,
  });

  const option = options.find((candidate) => candidate.id === provider);
  if (!option) return badRequest("이 패널에서 고를 수 없는 제공자입니다");
  if (!option.ready) return badRequest(option.hint ?? "지금은 쓸 수 없는 제공자입니다");

  const chosen = model?.trim() ?? "";
  if (chosen !== "" && !option.models.includes(chosen)) {
    return badRequest("고를 수 없는 모델입니다");
  }

  // model을 아예 안 보냈으면 제공자만 바꾸고 기존 모델 선택은 건드리지 않는다.
  const modelPatch =
    model === undefined
      ? {}
      : isCliProvider(provider)
        ? { cliProviders: { [provider]: { model: chosen } } }
        : { providers: { [provider]: { model: chosen } } };
  await store.save({ chatProvider: provider, ...modelPatch });

  return NextResponse.json(await chatProviderState(provider), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** 화면이 헤더 라벨을 바로 갈아 끼울 수 있도록, 저장 결과를 해석해서 돌려준다. */
async function chatProviderState(provider: ChatProviderId) {
  try {
    const { label, modelName } = await getChatModel();
    return { available: true, provider, label, modelName };
  } catch (error) {
    return {
      available: false,
      provider,
      reason: error instanceof Error ? error.message : "제공자를 준비하지 못했습니다",
    };
  }
}
