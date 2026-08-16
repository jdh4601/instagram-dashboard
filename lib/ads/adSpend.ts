import type { AdPerformance } from "@/lib/ads/map";
import type { AdSpend } from "@/lib/schemas";

/**
 * 수동으로 옮겨 적은 Ad Center 기록 → 광고 성과 모양.
 *
 * Marketing API에서 온 성과와 같은 자리에 놓으려고 모양을 맞춘다. 다만 참여
 * (좋아요·저장·공유·댓글)는 채우지 않는다 — Ad Center가 알려주지 않는 값이라
 * 0으로 채우면 "광고에 아무도 반응하지 않았다"는 거짓 사실이 된다.
 *
 * 결과 유형이 다르면 합치지 않는다. 프로필 방문 78건과 링크 클릭 40건을 더한
 * 118은 아무것도 세지 않은 수다.
 */
export function adSpendToPerformance(entries: AdSpend[]): AdPerformance[] {
  const byKey = new Map<string, AdPerformance>();

  for (const entry of entries) {
    const key = `${entry.mediaId}::${entry.resultType}`;
    const current = byKey.get(key) ?? {
      mediaId: entry.mediaId,
      adCount: 0,
      spend: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
      results: { count: 0, type: entry.resultType },
    };
    current.adCount += 1;
    current.spend += entry.spend;
    // 여러 번 태운 도달은 서로 겹치지만 Ad Center가 합집합을 주지 않는다.
    // CPM 분모로 노출을 쓰는 이유이기도 하다.
    current.reach += entry.reach;
    current.impressions += entry.views;
    current.results!.count += entry.resultCount;
    byKey.set(key, current);
  }

  return [...byKey.values()].sort((a, b) => b.spend - a.spend);
}
