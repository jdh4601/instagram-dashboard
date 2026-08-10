import { NextResponse } from "next/server";
import type { z } from "zod";

// zod 이슈를 화면에 그대로 띄울 수 있는 한 줄 메시지로 접는다. flatten() 구조를
// 그대로 내보내면 폼이 어떤 칸을 고쳐야 하는지 스스로 해석해야 한다.
export function invalidBody(error: z.ZodError): NextResponse {
  const detail = error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(", ");
  return NextResponse.json(
    { error: `요청 값이 올바르지 않습니다 — ${detail}` },
    { status: 400 },
  );
}
