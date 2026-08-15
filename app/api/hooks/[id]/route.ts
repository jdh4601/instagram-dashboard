import { NextResponse } from "next/server";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";
import { invalidBody } from "@/lib/api/validation";
import { HookPatchSchema } from "@/lib/schemas";
import { getHookRepository } from "@/lib/store";
import { resolveRuntimeConfig } from "@/lib/runtime/config";
import { removeReelBreakdownAssets } from "@/lib/reelBreakdown/files";

interface Context {
  params: Promise<{ id: string }>;
}

function notFound(): NextResponse {
  return NextResponse.json({ error: "훅을 찾을 수 없습니다" }, { status: 404 });
}

export async function GET(_req: Request, { params }: Context) {
  const hook = await getHookRepository().get((await params).id);
  return hook ? NextResponse.json({ hook }) : notFound();
}

/** 훅 수정. 하트 토글도 isFavorite 하나만 담아 이 라우트로 온다. */
export async function PATCH(req: Request, { params }: Context) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = HookPatchSchema.safeParse(body.value);
  if (!parsed.success) return invalidBody(parsed.error);

  const repo = getHookRepository();
  const existing = await repo.get((await params).id);
  if (!existing) return notFound();

  // 보낸 필드만 덮어쓴다. createdAt은 보관 순서의 기준이라 수정에서 제외한다.
  const next = { ...existing, ...parsed.data, updatedAt: new Date().toISOString() };

  return NextResponse.json({ hook: await repo.upsert(next) });
}

export async function DELETE(req: Request, { params }: Context) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;

  const id = (await params).id;
  const repo = getHookRepository();
  const existing = await repo.get(id);
  const removed = await repo.remove(id);
  if (!removed) return notFound();

  if (existing?.breakdown) {
    removeReelBreakdownAssets(resolveRuntimeConfig().dataDir, existing.breakdown.assetKey).catch(
      (error) => console.warn("[reel-breakdown] 훅 삭제 후 asset 정리 실패", error),
    );
  }

  return NextResponse.json({ ok: true });
}
