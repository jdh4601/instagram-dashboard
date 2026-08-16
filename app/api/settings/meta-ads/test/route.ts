import { NextResponse } from "next/server";
import { z } from "zod";
import { assertJsonRequest, readJsonBody } from "@/lib/api/guard";
import { getAdsConnection } from "@/lib/ads";
import { probeAdsConnection } from "@/lib/ads/probe";
import { AD_LOOKBACK_DAYS, adLookbackRange } from "@/lib/ads/window";

// 저장 화면이 보내는 값. 빈 문자열은 "입력하지 않음"이라 저장된 값으로 넘어간다.
const TestInputSchema = z.object({
  accessToken: z.string().optional(),
  adAccountId: z.string().optional(),
});

/**
 * 자격증명이 실제로 통하는지 확인한다.
 *
 * 저장 전에도 시험할 수 있어야 한다 — 그렇지 않으면 토큰이 맞는지 알아보려고
 * 멀쩡한 토큰을 덮어써야 한다. 응답에는 자격증명을 담지 않는다.
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

  const connection = await getAdsConnection(parsed.data);
  if (!connection) {
    return NextResponse.json(
      { error: "액세스 토큰과 광고 계정 id를 모두 입력하세요" },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const result = await probeAdsConnection(
    connection.client,
    connection.adAccountId,
    adLookbackRange(),
  );
  return NextResponse.json(
    { ...result, lookbackDays: AD_LOOKBACK_DAYS },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
