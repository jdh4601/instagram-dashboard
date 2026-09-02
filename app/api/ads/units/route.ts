import { NextResponse } from "next/server";
import { fetchAdUnits } from "@/lib/ads/cache";
import { AD_LOOKBACK_DAYS } from "@/lib/ads/window";

/**
 * 광고 한 건씩의 목록.
 *
 * 게시물별 효율표(`/api/ads`)와 축이 다르다. 저쪽은 한 게시물에 여러 번 태운 것을
 * 합쳐 견주고, 이쪽은 광고 하나가 한 줄이라 상태·목표·예산·기간을 그대로 보여 준다.
 *
 * 성과와 마찬가지로 저장하지 않는다. 외부 집계라 사본을 두면 화면과 광고 관리자가
 * 어긋나는 순간이 생긴다.
 */
export async function GET() {
  const { units, configured, error } = await fetchAdUnits();

  return NextResponse.json(
    { configured, units, lookbackDays: AD_LOOKBACK_DAYS, error },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
