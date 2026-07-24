import type { AccountSnapshot } from "@/lib/schemas";
import type { MetricInsight } from "@/lib/analysis/insightTypes";
import { COMPARISON_WINDOW_DAYS, comparisonPair } from "@/lib/analysis/comparisonWindow";

function percentChange(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined;
  return ((current - previous) / previous) * 100;
}

export function buildAccountInsights(snapshots: AccountSnapshot[]): MetricInsight[] {
  if (snapshots.length === 0) return [];
  // 비교 기준은 accountOverview와 공유한다. 두 모듈이 다른 기준을 쓰면 같은 화면에서
  // 도달 증감이 서로 반대로 표시된다.
  const { current, baseline: previous } = comparisonPair(snapshots);
  if (current === null) return [];
  const insights: MetricInsight[] = [];

  const netFollows =
    current.followsLast7d !== undefined && current.unfollowsLast7d !== undefined
      ? current.followsLast7d - current.unfollowsLast7d
      : undefined;
  if (netFollows !== undefined) {
    insights.push({
      id: "net-followers",
      title: netFollows >= 0 ? "순 팔로워가 늘었어요" : "순 팔로워가 줄었어요",
      detail: `최근 7일 팔로우 ${current.followsLast7d?.toLocaleString()}명, 언팔로우 ${current.unfollowsLast7d?.toLocaleString()}명으로 순변화 ${netFollows >= 0 ? "+" : ""}${netFollows.toLocaleString()}명입니다.`,
      tone: netFollows >= 0 ? "strength" : "opportunity",
      source: "API",
      currentValue: netFollows,
    });
  }

  if (current.reachLast7d > 0 && current.accountsEngagedLast7d !== undefined) {
    const rate = (current.accountsEngagedLast7d / current.reachLast7d) * 100;
    insights.push({
      id: "engaged-reach",
      title: "도달한 계정의 참여",
      detail: `최근 7일 도달 계정 중 ${rate.toFixed(2)}%가 반응했습니다.`,
      tone: "info",
      source: "derived",
      currentValue: rate,
    });
  }

  if (previous) {
    const reachChange = percentChange(current.reachLast7d, previous.reachLast7d);
    if (reachChange !== undefined) {
      insights.push({
        id: "reach-trend",
        title: reachChange >= 0 ? "7일 도달이 성장했어요" : "7일 도달이 둔화됐어요",
        detail: `${COMPARISON_WINDOW_DAYS}일 전(${previous.date})보다 ${Math.abs(reachChange).toFixed(1)}% ${reachChange >= 0 ? "증가" : "감소"}했습니다.`,
        tone: reachChange >= 0 ? "strength" : "opportunity",
        source: "derived",
        currentValue: current.reachLast7d,
        benchmarkValue: previous.reachLast7d,
      });
    }
  }
  return insights;
}
