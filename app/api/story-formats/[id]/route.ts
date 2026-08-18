import { NextResponse } from "next/server";
import { assertJsonRequest } from "@/lib/api/guard";
import { getSavedStoryFormatRepository } from "@/lib/store";

interface Context {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: Request, { params }: Context) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;

  const removed = await getSavedStoryFormatRepository().remove((await params).id);
  if (!removed) {
    return NextResponse.json({ error: "저장한 포맷을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
