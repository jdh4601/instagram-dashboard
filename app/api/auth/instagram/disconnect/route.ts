import { NextResponse } from "next/server";
import { assertJsonRequest } from "@/lib/api/guard";
import { getSettingsStore } from "@/lib/settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const blocked = assertJsonRequest(request);
  if (blocked) return blocked;
  await getSettingsStore().clearInstagramCredential();
  return NextResponse.json(
    { disconnected: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
