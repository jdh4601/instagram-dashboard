import type { Reel } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import type { MetricInsight } from "@/lib/analysis/insightTypes";

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function compare(
  id: string,
  title: string,
  current: number | undefined,
  peers: Array<number | undefined>,
  format: (value: number) => string,
): MetricInsight | null {
  const usable = peers.filter((value): value is number => value !== undefined);
  if (current === undefined || usable.length < 5) return null;
  const benchmark = median(usable);
  if (benchmark === undefined || benchmark === 0) return null;
  const ratio = current / benchmark;
  if (ratio >= 1.2) {
    return {
      id,
      title,
      detail: `${format(current)}로 최근 릴스 중앙값 ${format(benchmark)}보다 ${Math.round((ratio - 1) * 100)}% 높습니다.`,
      tone: "strength",
      source: "derived",
      currentValue: current,
      benchmarkValue: benchmark,
    };
  }
  if (ratio <= 0.8) {
    return {
      id,
      title,
      detail: `${format(current)}로 최근 릴스 중앙값 ${format(benchmark)}보다 ${Math.round((1 - ratio) * 100)}% 낮습니다.`,
      tone: "opportunity",
      source: "derived",
      currentValue: current,
      benchmarkValue: benchmark,
    };
  }
  return null;
}

export function buildReelInsights(reel: Reel, history: Reel[]): MetricInsight[] {
  const current = computeDerivedRates(reel);
  const peerRates = history.map(computeDerivedRates);
  const pct = (value: number) => `${value.toFixed(2)}%`;
  const multiple = (value: number) => `${value.toFixed(2)}회`;

  const compared = [
    compare(
      "interaction-reach",
      "도달 대비 반응",
      current.interactionRateByReach,
      peerRates.map((rate) => rate.interactionRateByReach),
      pct,
    ),
    compare(
      "high-intent",
      "저장·공유 의도",
      current.highIntentRate,
      peerRates.map((rate) => rate.highIntentRate),
      pct,
    ),
    compare(
      "follow-conversion",
      "팔로우 전환",
      current.followConversionRate,
      peerRates.map((rate) => rate.followConversionRate),
      pct,
    ),
    compare(
      "plays-per-reach",
      "반복 재생 신호",
      current.playsPerReachedAccount,
      peerRates.map((rate) => rate.playsPerReachedAccount),
      multiple,
    ),
  ].filter((insight): insight is MetricInsight => insight !== null);

  const insights = [...compared];
  if (current.playsPerReachedAccount !== undefined && current.playsPerReachedAccount >= 1.2) {
    insights.push({
      id: "repeat-consumption",
      title: "한 사람당 여러 번 재생됐어요",
      detail: `도달 계정당 ${multiple(current.playsPerReachedAccount)} 재생되어 반복 소비 신호가 있습니다.`,
      tone: "info",
      source: "derived",
      currentValue: current.playsPerReachedAccount,
    });
  }
  if (
    current.profileVisitRate !== undefined &&
    current.profileToFollowRate !== undefined &&
    current.profileVisitRate > 0 &&
    current.profileToFollowRate < 10
  ) {
    insights.push({
      id: "profile-funnel",
      title: "프로필 이후 팔로우 전환을 다듬어야 해요",
      detail: `프로필 방문률은 ${pct(current.profileVisitRate)}지만 방문 후 팔로우 전환은 ${pct(current.profileToFollowRate)}입니다.`,
      tone: "opportunity",
      source: "derived",
      currentValue: current.profileToFollowRate,
    });
  }
  if (reel.audienceBreakdown?.nonFollowersPct !== undefined) {
    insights.push({
      id: "non-follower-reach",
      title: "비팔로워 도달",
      detail: `EDIT 기준 도달의 ${reel.audienceBreakdown.nonFollowersPct.toFixed(1)}%가 비팔로워입니다.`,
      tone: "info",
      source: "EDIT",
      currentValue: reel.audienceBreakdown.nonFollowersPct,
    });
  }
  return insights;
}
