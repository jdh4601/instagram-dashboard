import { NextResponse } from "next/server";
import { assertJsonRequest } from "@/lib/api/guard";
import { getChatStore } from "@/lib/chat";
import { notFoundIfRemote } from "@/lib/chat/routeGuard";

interface Context {
  params: Promise<{ id: string }>;
}

/** 이전 대화를 연다. 여는 순간 그 대화가 활성이 되어 다음 질문이 이어 붙는다. */
export async function GET(_req: Request, { params }: Context) {
  const blocked = notFoundIfRemote();
  if (blocked) return blocked;

  const store = getChatStore();
  const conversation = await store.open((await params).id);
  if (!conversation) {
    return NextResponse.json({ error: "대화를 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json({
    activeId: conversation.id,
    messages: conversation.messages,
    conversations: await store.list(),
  });
}

export async function DELETE(req: Request, { params }: Context) {
  const blocked = notFoundIfRemote() ?? assertJsonRequest(req);
  if (blocked) return blocked;

  const store = getChatStore();
  await store.remove((await params).id);

  // 활성 대화를 지웠으면 저장소가 다음 대화를 활성으로 골라 준다. 화면이 무엇을
  // 보여줘야 할지 다시 물어보지 않아도 되도록 새 활성 대화까지 함께 돌려준다.
  const [conversations, activeId, messages] = await Promise.all([
    store.list(),
    store.activeId(),
    store.get(),
  ]);
  return NextResponse.json({ conversations, activeId, messages });
}
