import { NextResponse } from "next/server";
import { getRepository, getAdSpendRepository } from "@/lib/store";
import { getAdsConnection } from "@/lib/ads";
import { AdsRequestError } from "@/lib/ads/client";
import { adSpendToPerformance } from "@/lib/ads/adSpend";
import { AD_LOOKBACK_DAYS, adLookbackRange } from "@/lib/ads/window";
import type { AdPerformance } from "@/lib/ads/map";
import {
  buildAdEfficiency,
  groupByResultType,
  sumAdEfficiency,
  type AdEfficiencySort,
} from "@/lib/analysis/adEfficiency";

const SORTS: AdEfficiencySort[] = [
  "spend",
  "costPerEngagement",
  "costPerResult",
  "cpm",
  "efficiencyRatio",
];

function parseSort(raw: string | null): AdEfficiencySort {
  return SORTS.includes(raw as AdEfficiencySort) ? (raw as AdEfficiencySort) : "spend";
}

/**
 * 게시물별 광고 효율.
 *
 * 두 출처를 합친다. Marketing API는 광고 관리자에서 집행한 광고를 주고, 수동 기록은
 * 인스타그램 앱 '홍보하기' 부스트를 메운다 — 후자는 Ad Center에만 남아 API가 영영
 * 볼 수 없다(Ads Manager UI도 똑같이 0을 보고한다).
 *
 * API 성과는 저장하지 않고 요청할 때마다 묻는다. 우리가 만드는 값이 아니라 외부
 * 집계라, 사본을 두면 화면과 광고 관리자가 어긋나는 순간이 생긴다.
 */
export async function GET(req: Request) {
  const sort = parseSort(new URL(req.url).searchParams.get("sort"));
  const [reels, manualEntries] = await Promise.all([
    getRepository().list(),
    getAdSpendRepository().list(),
  ]);
  const manual = adSpendToPerformance(manualEntries);

  const connection = await getAdsConnection();
  let fetched: AdPerformance[] = [];
  let apiError: string | null = null;

  if (connection) {
    try {
      fetched = await connection.client.listAdPerformance(
        connection.adAccountId,
        adLookbackRange(),
      );
    } catch (err) {
      // 원문에 토큰이 섞일 수 있어 클라이언트가 만든 안전한 문구만 흘린다.
      apiError =
        err instanceof AdsRequestError ? err.message : "Marketing API에 연결하지 못했습니다";
    }
  }

  // API 연동이 실패해도 수동 기록은 그대로 보여 준다 — 손으로 옮겨 적은 과거가
  // 외부 API 장애로 화면에서 사라지면 안 된다.
  const performance = [...fetched, ...manual];
  const rows = buildAdEfficiency(performance, reels, sort);

  return NextResponse.json(
    {
      configured: connection !== null || manual.length > 0,
      rows,
      groups: groupByResultType(rows),
      totals: sumAdEfficiency(rows),
      lookbackDays: AD_LOOKBACK_DAYS,
      /** 광고는 있는데 저장된 게시물에 못 붙은 수. 0이 아니면 동기화를 먼저 돌려야 한다. */
      unmatchedAds: performance.length - rows.length,
      manualCount: manual.length,
      apiConfigured: connection !== null,
      apiError,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
