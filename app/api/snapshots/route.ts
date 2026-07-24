import { NextResponse } from "next/server";
import { getAccountRepository } from "@/lib/store";
import { AccountSnapshotSchema } from "@/lib/schemas";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";

export async function GET() {
  const snapshots = await getAccountRepository().list();
  return NextResponse.json({ snapshots });
}

export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = AccountSnapshotSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const saved = await getAccountRepository().add(parsed.data);
  return NextResponse.json({ snapshot: saved });
}
