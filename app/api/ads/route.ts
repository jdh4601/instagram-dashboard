import { NextResponse } from "next/server";
import { getRepository, getAdSpendRepository } from "@/lib/store";
import { adSpendToPerformance } from "@/lib/ads/adSpend";
import { fetchAdPerformance } from "@/lib/ads/cache";
import { AD_LOOKBACK_DAYS } from "@/lib/ads/window";
import {
  buildAdEfficiency,
  sumAdEfficiency,
  type AdEfficiencySort,
} from "@/lib/analysis/adEfficiency";

const SORTS: AdEfficiencySort[] = [
  "spend",
  "adReach",
  "cpm",
  "costPerResult",
  "resultRate",
  "costPerEngagement",
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
 * API 성과는 파일로 저장하지 않는다. 우리가 만드는 값이 아니라 외부 집계라, 사본을
 * 두면 화면과 광고 관리자가 어긋나는 순간이 생긴다. 대신 lib/ads/cache가 짧게만
 * 들고 있어, 목록과 상세가 게시물마다 계정 전체를 다시 받지 않는다.
 */
export async function GET(req: Request) {
  const sort = parseSort(new URL(req.url).searchParams.get("sort"));
  const [reels, manualEntries, fetched] = await Promise.all([
    getRepository().list(),
    getAdSpendRepository().list(),
    fetchAdPerformance(),
  ]);
  const manual = adSpendToPerformance(manualEntries);

  // API 연동이 실패해도 수동 기록은 그대로 보여 준다 — 손으로 옮겨 적은 과거가
  // 외부 API 장애로 화면에서 사라지면 안 된다.
  const performance = [...fetched.performance, ...manual];
  const rows = buildAdEfficiency(performance, reels, sort);

  return NextResponse.json(
    {
      configured: fetched.configured || manual.length > 0,
      rows,
      totals: sumAdEfficiency(rows),
      lookbackDays: AD_LOOKBACK_DAYS,
      /** 광고는 있는데 저장된 게시물에 못 붙은 수. 0이 아니면 동기화를 먼저 돌려야 한다. */
      unmatchedAds: performance.length - rows.length,
      manualCount: manual.length,
      apiConfigured: fetched.configured,
      apiError: fetched.error,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
