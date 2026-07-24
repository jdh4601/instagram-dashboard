import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { ReelSchema } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";

export async function GET() {
  const reels = await getRepository().list();
  return NextResponse.json({ reels });
}

export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = ReelSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const reel = { ...parsed.data, derived: computeDerivedRates(parsed.data) };
  const saved = await getRepository().upsert(reel);
  return NextResponse.json({ reel: saved });
}
