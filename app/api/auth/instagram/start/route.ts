import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildInstagramAuthorizationUrl,
  INSTAGRAM_OAUTH_STATE_COOKIE,
  resolveInstagramOAuthConfig,
} from "@/lib/instagram/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let config;
  try {
    config = resolveInstagramOAuthConfig();
  } catch {
    return NextResponse.json({ error: "Instagram OAuth configuration is incomplete." }, { status: 503 });
  }
  if (!config) {
    return NextResponse.json({ error: "Instagram OAuth is not configured." }, { status: 503 });
  }

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(buildInstagramAuthorizationUrl(config, state));
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(config.redirectUri).protocol === "https:",
    path: "/api/auth/instagram/callback",
    maxAge: 10 * 60,
  });
  return response;
}
