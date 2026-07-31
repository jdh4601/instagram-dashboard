import { NextResponse } from "next/server";
import { resolveRuntimeConfig } from "@/lib/runtime/config";

/**
 * 챗봇은 로컬 실행에서만 제공한다. 원격 배포에서는 기능이 "없는" 것이므로
 * 403이 아니라 404로 답한다 — 화면은 이 응답을 보고 패널 자체를 그리지 않는다.
 */
export function notFoundIfRemote(): NextResponse | null {
  if (resolveRuntimeConfig().isLocalRuntime) return null;
  return NextResponse.json(
    { error: "이 기능은 로컬 실행에서만 사용할 수 있습니다" },
    { status: 404 },
  );
}
