import { NextResponse } from "next/server";
import { z } from "zod";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";
import { getAccountRepository, getProfileRepository, getRepository } from "@/lib/store";
import { getChatStore } from "@/lib/chat";
import { notFoundIfRemote } from "@/lib/chat/routeGuard";
import { buildAccountContext, renderAccountContext } from "@/lib/chat/context";
import { selectContextReels } from "@/lib/chat/reelMention";
import { buildChatSystemPrompt, selectContextTurns } from "@/lib/chat/prompt";
import { getChatModel } from "@/lib/llm/chat";
import type { ChatTurn } from "@/lib/llm/types";

const BodySchema = z.object({
  message: z.string().trim().min(1),
  /** 질문할 때 열어 두고 있던 릴스. 지목하는 말이 없어도 이 릴스를 컨텍스트에 싣는다. */
  reelId: z.string().trim().min(1).optional(),
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다";
}

export async function GET() {
  const unavailable = notFoundIfRemote();
  if (unavailable) return unavailable;

  const store = getChatStore();
  const [messages, conversations, activeId] = await Promise.all([
    store.get(),
    store.list(),
    store.activeId(),
  ]);

  try {
    const { provider, label } = await getChatModel();
    return NextResponse.json({
      available: true,
      provider,
      label,
      messages,
      conversations,
      activeId,
    });
  } catch (error) {
    // 제공자가 아직 설정되지 않은 것은 오류가 아니라 "아직 못 쓰는 상태"다.
    // 대화 기록은 그대로 돌려줘야 패널이 지난 진단을 계속 보여줄 수 있다.
    return NextResponse.json({
      available: false,
      reason: errorMessage(error),
      messages,
      conversations,
      activeId,
    });
  }
}

export async function POST(req: Request) {
  const blocked = notFoundIfRemote() ?? assertJsonRequest(req);
  if (blocked) return blocked;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = BodySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "메시지를 입력해 주세요" }, { status: 400 });
  }
  const { message, reelId } = parsed.data;

  const store = getChatStore();
  const history = await store.append([
    { role: "user", content: message, createdAt: new Date().toISOString() },
  ]);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const { model, provider, label } = await getChatModel();

        const [reels, snapshots, profile] = await Promise.all([
          getRepository().list(),
          getAccountRepository().list(),
          getProfileRepository().get(),
        ]);

        const context = renderAccountContext(buildAccountContext(reels, snapshots, profile));
        const system = buildChatSystemPrompt(
          context,
          selectContextReels(message, reelId, reels),
        );
        const turns: ChatTurn[] = selectContextTurns(
          history.map((record) => ({ role: record.role, content: record.content })),
        );

        let answer = "";
        for await (const delta of model.stream({ system, turns, signal: req.signal })) {
          answer += delta;
          send({ type: "delta", text: delta });
        }

        // 중간에 끊긴 답변을 저장하면 다음 턴의 컨텍스트가 오염된다.
        if (req.signal.aborted) {
          controller.close();
          return;
        }

        const record = {
          role: "assistant" as const,
          content: answer,
          createdAt: new Date().toISOString(),
          provider,
        };
        await store.append([record]);
        send({ type: "done", message: record, label });
      } catch (error) {
        // 스트림 헤더는 이미 나갔으므로 상태 코드로는 실패를 알릴 수 없다.
        send({ type: "error", error: errorMessage(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// 대화를 지우는 일은 목록이 생기면서 /api/chat/conversations/[id]로 옮겨 갔다.
