import type { Reel, DerivedRates } from "@/lib/schemas";

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function optionalRate(numerator: number | undefined, denominator: number): number | undefined {
  if (numerator === undefined || denominator <= 0) return undefined;
  return (numerator / denominator) * 100;
}

export function computeDerivedRates(reel: Reel): DerivedRates {
  const { views, likes, comments, saves, shares, avgWatchTimeSec, durationSec, reach } = reel;
  const engagementCount = likes + comments + saves + shares;
  const totalInteractions = reel.totalInteractions ?? engagementCount;

  const derived: DerivedRates = {
    shareRate: rate(shares, views),
    saveRate: rate(saves, views),
    likeRate: rate(likes, views),
    commentRate: rate(comments, views),
    engagementRate: rate(engagementCount, views),
    completionRate: rate(avgWatchTimeSec, durationSec),
    interactionRateByReach: optionalRate(totalInteractions, reach),
    interactionRateByView: optionalRate(totalInteractions, views),
    saveRateByReach: optionalRate(saves, reach),
    shareRateByReach: optionalRate(shares, reach),
    commentRateByReach: optionalRate(comments, reach),
    likeRateByReach: optionalRate(likes, reach),
    highIntentRate: optionalRate(saves + shares, reach),
    playsPerReachedAccount: reach > 0 ? views / reach : undefined,
    replayRate: optionalRate(reel.replays, views),
    watchTimePerView:
      reel.totalWatchTimeSec !== undefined && views > 0
        ? reel.totalWatchTimeSec / views
        : undefined,
    averageWatchPercentage:
      durationSec > 0 ? (avgWatchTimeSec / durationSec) * 100 : undefined,
  };

  if (reel.followsFromReel !== undefined) {
    derived.followRate = rate(reel.followsFromReel, views);
    derived.followConversionRate = rate(reel.followsFromReel, reach);
  }
  if (reel.profileVisits !== undefined) {
    derived.profileVisitRate = rate(reel.profileVisits, reach);
  }
  if (reel.followsFromReel !== undefined && reel.profileVisits !== undefined) {
    derived.profileToFollowRate = optionalRate(reel.followsFromReel, reel.profileVisits);
  }
  return derived;
}
