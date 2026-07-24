import { NextResponse } from "next/server";
import { getSettingsStore } from "@/lib/settings";
import { SettingsInputSchema } from "@/lib/settings/store";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";

// GET: 마스킹된 설정만 반환 (실제 키는 절대 클라이언트로 내보내지 않음)
export async function GET() {
  const masked = await getSettingsStore().masked();
  return NextResponse.json(masked);
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
  return NextResponse.json(await store.masked());
}
