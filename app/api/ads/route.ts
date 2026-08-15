import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { getAdsConnection } from "@/lib/ads";
import { AdsRequestError } from "@/lib/ads/client";
import { AD_LOOKBACK_DAYS, adLookbackRange } from "@/lib/ads/window";
import {
  buildAdEfficiency,
  sumAdEfficiency,
  type AdEfficiencySort,
} from "@/lib/analysis/adEfficiency";

const SORTS: AdEfficiencySort[] = ["spend", "costPerEngagement", "cpm", "efficiencyRatio"];

function parseSort(raw: string | null): AdEfficiencySort {
  return SORTS.includes(raw as AdEfficiencySort) ? (raw as AdEfficiencySort) : "spend";
}

/**
 * 게시물별 광고 효율.
 *
 * 저장하지 않고 요청할 때마다 Marketing API에 묻는다. 광고 성과는 우리가 만드는
 * 값이 아니라 외부 집계라, 사본을 두면 화면과 광고 관리자가 어긋나는 순간이 생긴다.
 * 호출도 두 번뿐이라 캐시할 만큼 비싸지 않다.
 */
export async function GET(req: Request) {
  const connection = await getAdsConnection();
  if (!connection) {
    return NextResponse.json(
      { configured: false, rows: [], totals: null, lookbackDays: AD_LOOKBACK_DAYS },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const sort = parseSort(new URL(req.url).searchParams.get("sort"));
  let performance;
  try {
    performance = await connection.client.listAdPerformance(
      connection.adAccountId,
      adLookbackRange(),
    );
  } catch (err) {
    // 원문에 토큰이 섞일 수 있어 클라이언트가 만든 안전한 문구만 흘린다.
    const message =
      err instanceof AdsRequestError ? err.message : "Marketing API에 연결하지 못했습니다";
    return NextResponse.json(
      { configured: true, error: message },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const reels = await getRepository().list();
  const rows = buildAdEfficiency(performance, reels, sort);

  return NextResponse.json(
    {
      configured: true,
      rows,
      totals: sumAdEfficiency(rows),
      lookbackDays: AD_LOOKBACK_DAYS,
      /** 광고는 있는데 저장된 게시물에 못 붙은 수. 0이 아니면 동기화를 먼저 돌려야 한다. */
      unmatchedAds: performance.length - rows.length,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
