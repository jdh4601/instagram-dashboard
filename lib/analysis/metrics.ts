import type { Reel, DerivedRates } from "@/lib/schemas";
import type { MetricKey } from "@/config/benchmarks";
import { mediaKindOf } from "@/lib/media/kind";

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

/**
 * 벤치마크 표의 한 지표를 이 게시물에서 읽는다. 포맷마다 분모가 다르다.
 *
 * 릴스는 조회수를 분모로 쓴다 — 영상은 재생이 곧 소비라 분모가 맞다.
 * 캐러셀은 도달을 분모로 쓴다. 캐러셀의 views는 노출이라 도달의 3배 안팎으로 부풀고
 * (실측 32건 중앙값 3.4배, 릴스 1.3배), 그 분모로는 같은 성과가 릴스보다 3배 작게
 * 나온다. 프로필 방문율은 원래부터 도달 분모여서, 조회수 분모와 섞이면 한 벤치마크
 * 표 안에 서로 다른 두 개의 자가 놓인다.
 *
 * 진단(diagnosis)과 베이스라인(baseline)이 모두 이 함수를 거친다. 판정하는 값과
 * 기준을 만드는 값이 갈라지면 임계값이 소리 없이 어긋난다.
 */
export function metricValue(reel: Reel, key: MetricKey): number | undefined {
  const d = computeDerivedRates(reel);

  if (key === "hookRetention3s") return reel.hookRetention3s;
  // 길이를 모르면(0) 완료율은 계산할 수 없다 → 판정에서 빠진다
  if (key === "completionRate") return reel.durationSec > 0 ? d.completionRate : undefined;
  // 게시물 레벨 프로필 방문은 두 포맷 모두 도달이 분모다
  if (key === "profileVisitRate") return d.profileVisitRate;

  if (mediaKindOf(reel) === "REELS") return d[key];

  const byReach: Record<string, number | undefined> = {
    saveRate: d.saveRateByReach,
    shareRate: d.shareRateByReach,
    likeRate: d.likeRateByReach,
    commentRate: d.commentRateByReach,
    followRate: d.followConversionRate,
  };
  return byReach[key];
}
