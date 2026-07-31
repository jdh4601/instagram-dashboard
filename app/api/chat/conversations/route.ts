import { NextResponse } from "next/server";
import { assertJsonRequest } from "@/lib/api/guard";
import { getChatStore } from "@/lib/chat";
import { notFoundIfRemote } from "@/lib/chat/routeGuard";

export async function GET() {
  const blocked = notFoundIfRemote();
  if (blocked) return blocked;

  const store = getChatStore();
  const [conversations, activeId] = await Promise.all([store.list(), store.activeId()]);
  return NextResponse.json({ conversations, activeId });
}

/** 새 대화를 연다. 응답에 목록까지 담아 화면이 한 번의 왕복으로 갱신되게 한다. */
export async function POST(req: Request) {
  const blocked = notFoundIfRemote() ?? assertJsonRequest(req);
  if (blocked) return blocked;

  const store = getChatStore();
  const activeId = await store.create();
  return NextResponse.json({ activeId, conversations: await store.list(), messages: [] });
}
