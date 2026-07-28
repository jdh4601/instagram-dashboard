import { NextResponse } from "next/server";

// 대시보드 전체를 보호하는 Basic Auth 가드. DASHBOARD_USER/DASHBOARD_PASSWORD가
// 설정되지 않은 경우(로컬 개발 기본값) 인증 없이 통과시킨다.
//
// 미들웨어는 기본적으로 Edge 런타임에서 실행되어 node:crypto를 쓸 수 없으므로,
// timingSafeEqual 대신 의존성 없는 상수 시간 비교를 직접 구현한다.

const REALM = "Instagram Dashboard";

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "인증이 필요합니다" },
    { status: 401, headers: { "WWW-Authenticate": `Basic realm="${REALM}"` } },
  );
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function parseBasicAuth(header: string | null): { user: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf-8");
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return null;

  return {
    user: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

export function checkBasicAuth(req: Request): NextResponse | null {
  const expectedUser = process.env.DASHBOARD_USER;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  if (!expectedUser || !expectedPassword) return null;

  const credentials = parseBasicAuth(req.headers.get("authorization"));
  if (!credentials) return unauthorized();

  // 사용자명/비밀번호를 둘 다 계산한 뒤 결합해, 어느 쪽이 틀렸는지로
  // 타이밍 차이가 새지 않게 한다.
  const userMatches = timingSafeStringEqual(credentials.user, expectedUser);
  const passwordMatches = timingSafeStringEqual(credentials.password, expectedPassword);
  if (!userMatches || !passwordMatches) return unauthorized();

  return null;
}
