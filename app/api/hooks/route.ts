import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";
import { invalidBody } from "@/lib/api/validation";
import { HookDraftSchema, type Hook } from "@/lib/schemas";
import { getHookRepository } from "@/lib/store";

/** 훅 보관함 전체. 정렬·필터는 화면이 하고 여기서는 저장 순서 그대로 넘긴다. */
export async function GET() {
  const hooks = await getHookRepository().list();
  return NextResponse.json({ hooks });
}

export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = HookDraftSchema.safeParse(body.value);
  if (!parsed.success) return invalidBody(parsed.error);

  // id와 시각은 서버가 정한다. 클라이언트가 보낸 값을 그대로 쓰면 기존 훅을
  // 덮어쓰거나 보관 순서를 흔들 수 있다(스키마가 두 필드를 아예 받지 않는 이유).
  const now = new Date().toISOString();
  const hook: Hook = {
    ...parsed.data,
    id: randomUUID(),
    isFavorite: parsed.data.isFavorite ?? false,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json({ hook: await getHookRepository().upsert(hook) }, { status: 201 });
}
