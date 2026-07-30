import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSettingsStore } from "@/lib/settings";
import {
  exchangeInstagramAuthorizationCode,
  INSTAGRAM_OAUTH_STATE_COOKIE,
  resolveInstagramOAuthConfig,
} from "@/lib/instagram/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameState(expected: string | undefined, received: string | null): boolean {
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

function settingsRedirect(request: NextRequest, result: "connected" | "error"): NextResponse {
  const response = NextResponse.redirect(new URL(`/settings?instagram=${result}`, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/api/auth/instagram/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const expectedState = request.cookies.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value;
  const state = request.nextUrl.searchParams.get("state");
  if (!sameState(expectedState, state)) {
    return NextResponse.json(
      { error: "Invalid or expired OAuth state." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  if (!code || providerError) return settingsRedirect(request, "error");

  try {
    const config = resolveInstagramOAuthConfig();
    if (!config) return settingsRedirect(request, "error");
    const token = await exchangeInstagramAuthorizationCode(code, config);
    const expiresAt =
      token.expiresIn === null
        ? undefined
        : new Date(Date.now() + token.expiresIn * 1_000).toISOString();
    await getSettingsStore().saveInstagramCredential({
      accessToken: token.accessToken,
      expiresAt,
    });
    return settingsRedirect(request, "connected");
  } catch {
    return settingsRedirect(request, "error");
  }
}
