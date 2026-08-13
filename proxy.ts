import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth } from "@/lib/auth/basicAuth";

export function proxy(request: NextRequest): NextResponse {
  const blocked = checkBasicAuth(request);
  return blocked ?? NextResponse.next();
}

export const config = {
  // /api/cron/*는 CRON_SECRET(launchd) 또는 Vercel Cron의 Authorization: Bearer로
  // 별도 보호되므로 제외한다 — Basic Auth를 씌우면 스케줄러 호출이 막힌다.
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
