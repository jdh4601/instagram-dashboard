import { NextResponse } from "next/server";

// CSRF 차단 가드. 브라우저는 preflight 없는 "simple request"(text/plain 등)를
// cross-origin으로 본문까지 실어 볼 수 있으므로, 악성 페이지가 사용자 브라우저를
// 통해 localhost API를 호출해 설정을 덮어쓰거나 유료 LLM 호출을 유발할 수 있다.
// mutating 핸들러(POST/DELETE 등) 진입 시 가장 먼저 호출한다.

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function unsupportedMediaType(): NextResponse {
  return NextResponse.json(
    { error: "application/json 본문만 허용됩니다" },
    { status: 415 },
  );
}

function forbiddenOrigin(): NextResponse {
  return NextResponse.json({ error: "허용되지 않은 Origin입니다" }, { status: 403 });
}

function invalidJson(): NextResponse {
  return NextResponse.json({ error: "올바른 JSON 요청 본문이 필요합니다" }, { status: 400 });
}

// Content-Type 없이 본문만 실린 요청(curl -d 등)도 차단하기 위한 본문 감지.
function declaresBody(req: Request): boolean {
  const te = req.headers.get("transfer-encoding");
  if (te && te.toLowerCase() !== "identity") return true;
  const cl = req.headers.get("content-length");
  return cl !== null && cl !== "0";
}

// 415: 본문을 갖는 메서드인데 Content-Type이 application/json이 아님.
// 403: Origin 헤더가 있고 전체 origin(scheme + host + port)이 실제 요청 authority와 다름.
// 통과 시 null. curl처럼 Origin이 없는 비브라우저 클라이언트(cron 등)는 허용한다.
// Next dev/start를 0.0.0.0에 바인딩하면 req.url도 0.0.0.0으로 구성될 수 있으므로,
// 브라우저가 실제로 요청한 authority는 보호된 Host 헤더를 우선 사용한다.
// 역방향 프록시는 외부 scheme을 req.url에 반영해야 한다.
export function assertJsonRequest(req: Request): NextResponse | null {
  if (BODY_METHODS.has(req.method.toUpperCase())) {
    const contentType = req.headers.get("content-type");
    if (contentType !== null) {
      const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
      if (mediaType !== "application/json") {
        return unsupportedMediaType();
      }
    } else if (declaresBody(req)) {
      return unsupportedMediaType();
    }
  }

  const origin = req.headers.get("origin");
  if (origin !== null) {
    try {
      const requestUrl = new URL(req.url);
      const requestHost = req.headers.get("host")?.trim();
      const expectedOrigin = requestHost
        ? new URL(`${requestUrl.protocol}//${requestHost}`).origin
        : requestUrl.origin;
      if (new URL(origin).origin !== expectedOrigin) {
        return forbiddenOrigin();
      }
    } catch {
      return forbiddenOrigin();
    }
  }

  return null;
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

// JSON 파싱 실패를 프레임워크 500으로 흘리지 않고 일관된 400 계약으로 바꾼다.
// Content-Type/Origin 검사는 핸들러가 이 함수보다 먼저 assertJsonRequest로 수행한다.
export async function readJsonBody(req: Request): Promise<JsonBodyResult> {
  try {
    return { ok: true, value: await req.json() };
  } catch {
    return { ok: false, response: invalidJson() };
  }
}
