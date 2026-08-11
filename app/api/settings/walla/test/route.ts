import { NextResponse } from "next/server";
import { z } from "zod";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";
import { getWallaConnection } from "@/lib/walla";
import { probeWallaConnection } from "@/lib/walla/probe";

// 저장 화면이 보내는 값. 빈 문자열은 "입력하지 않음"이라 저장된 키로 넘어간다.
const TestInputSchema = z.object({
  apiKey: z.string().optional(),
  formId: z.string().optional(),
});

/**
 * 자격증명이 실제로 통하는지 확인한다.
 *
 * 저장 전에도 시험할 수 있어야 한다. 그렇지 않으면 키가 맞는지 알아보려고 멀쩡한
 * 키를 덮어써야 하고, 확인 방법이 전체 동기화(수십 초)뿐이 된다.
 *
 * 응답에는 키를 담지 않는다 — probe가 돌려주는 문구도 마찬가지다.
 */
export async function POST(req: Request) {
  const blocked = assertJsonRequest(req);
  if (blocked) return blocked;

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = TestInputSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const connection = await getWallaConnection(parsed.data);
  if (!connection) {
    return NextResponse.json(
      { error: "API 키와 폼 ID를 모두 입력하세요" },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const result = await probeWallaConnection(connection.client, connection.formId);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
