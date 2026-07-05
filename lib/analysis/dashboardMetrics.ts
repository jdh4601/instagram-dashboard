import type { Reel } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { BENCHMARKS } from "@/config/benchmarks";
import { reelTitle } from "@/lib/ui/reelTitle";

export interface ReelMetricPoint {
  idx: number;
  postedAt: string;
  title: string;
  avgWatchTimeSec: number;
  durationSec: number;
  // 결손은 0이 아니라 null — 차트에서 갭으로 그려 "데이터없음"과 "0"을 구분한다
  completionRate: number | null;
  skipRate: number | null;
  followConversionRate: number | null;
  profileVisitRate: number | null;
}

export interface HighSkipReel {
  idx: number;
  title: string;
  skipRate: number;
}

export interface TopFollowReel {
  idx: number;
  title: string;
  rate: number;
  follows: number;
  reach: number;
}

export interface DashboardMetrics {
  /** 평균 시청 시간(초) */
  avgWatchTimeSec: number | null;
  /** 평균 시청 비율(%): 평균 시청시간 / 영상 길이 */
  completionRate: number | null;
  /** 평균 영상 길이(초). 상대적 해석용 */
  avgDurationSec: number | null;
  /** 평균 Skip Rate(%) */
  skipRate: number | null;
  /** 평균 팔로우 전환율(%) */
  followConversionRate: number | null;
  /** 평균 프로필 방문률(%) */
  profileVisitRate: number | null;
  /** 시간순(오래된→최신) 릴스 지표 시리즈 */
  series: ReelMetricPoint[];
  /** 3초 후 이탈이 심한 릴스(약점 임계값 초과) */
  highSkipReels: HighSkipReel[];
  /** 팔로우 전환율 상위 릴스 */
  topFollowConversionReels: TopFollowReel[];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeDashboardMetrics(reels: Reel[]): DashboardMetrics {
  const sorted = [...reels].sort((a, b) => a.postedAt.localeCompare(b.postedAt));

  const series: ReelMetricPoint[] = sorted.map((r, i) => {
    const d = computeDerivedRates(r);
    const skipRate = r.skipRate != null ? r.skipRate : (r.hookRetention3s != null ? 100 - r.hookRetention3s : null);
    return {
      idx: i + 1,
      postedAt: r.postedAt.slice(0, 10),
      title: reelTitle(r),
      avgWatchTimeSec: r.avgWatchTimeSec,
      durationSec: r.durationSec,
      completionRate: r.durationSec > 0 ? (d.averageWatchPercentage ?? null) : null,
      skipRate,
      followConversionRate: r.followsFromReel !== undefined ? (d.followConversionRate ?? 0) : null,
      profileVisitRate: r.profileVisits !== undefined ? (d.profileVisitRate ?? 0) : null,
    };
  });

  const avgWatchTimeSec = average(series.map((s) => s.avgWatchTimeSec));
  const durationSeries = series.filter((s) => s.durationSec > 0);
  const completionRate = average(
    durationSeries
      .map((s) => s.completionRate)
      .filter((v): v is number => v !== null),
  );
  const avgDurationSec = average(durationSeries.map((s) => s.durationSec));
  const skipRate = average(
    series.filter((s) => s.skipRate !== null).map((s) => s.skipRate!),
  );

  // 팔로우/프로필 방문은 필드가 정의된 릴스만 집계(0도 평균에 포함, 미정의는 제외)
  const followConversionRate = average(
    sorted.filter((r) => r.followsFromReel !== undefined).map((r) => {
      const d = computeDerivedRates(r);
      return d.followConversionRate ?? 0;
    }),
  );
  const profileVisitRate = average(
    sorted.filter((r) => r.profileVisits !== undefined).map((r) => {
      const d = computeDerivedRates(r);
      return d.profileVisitRate ?? 0;
    }),
  );

  const skipWeakAbove = 100 - BENCHMARKS.hookRetention3s.weakBelow;
  const highSkipReels: HighSkipReel[] = series
    .filter((s): s is ReelMetricPoint & { skipRate: number } =>
      s.skipRate !== null && s.skipRate > skipWeakAbove,
    )
    .map((s) => ({ idx: s.idx, title: s.title, skipRate: s.skipRate }));

  const topFollowConversionReels: TopFollowReel[] = series
    .filter((s) => sorted[s.idx - 1].followsFromReel !== undefined)
    .sort((a, b) => (b.followConversionRate ?? 0) - (a.followConversionRate ?? 0))
    .slice(0, 5)
    .map((s) => ({
      idx: s.idx,
      title: s.title,
      rate: s.followConversionRate ?? 0,
      follows: sorted[s.idx - 1].followsFromReel ?? 0,
      reach: sorted[s.idx - 1].reach,
    }));

  return {
    avgWatchTimeSec,
    completionRate,
    avgDurationSec,
    skipRate,
    followConversionRate,
    profileVisitRate,
    series,
    highSkipReels,
    topFollowConversionReels,
  };
}
