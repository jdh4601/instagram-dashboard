import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { fetchAdUnits } from "@/lib/ads/cache";
import { findPostForAdUnit } from "@/lib/analysis/adUnitJoin";

/**
 * 광고 한 건의 상세.
 *
 * 목록과 같은 캐시를 나눠 쓴다. 광고 하나를 열 때마다 계정 전체를 다시 받으면
 * 목록에서 상세로 오갈 때마다 Marketing API를 두드리게 된다.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ adId: string }> }) {
  const { adId } = await ctx.params;
  const [{ units, error }, reels] = await Promise.all([fetchAdUnits(), getRepository().list()]);

  // 읽지 못한 것과 없는 것을 구분한다. 연결이 끊겨서 안 보이는 광고를 404로 알리면
  // 사용자가 지워진 광고로 오해한다.
  if (error) return NextResponse.json({ error }, { status: 502 });

  const unit = units.find((row) => row.adId === adId);
  if (!unit) return NextResponse.json({ error: "광고를 찾지 못했습니다" }, { status: 404 });

  return NextResponse.json(
    { unit, post: findPostForAdUnit(unit, reels) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
