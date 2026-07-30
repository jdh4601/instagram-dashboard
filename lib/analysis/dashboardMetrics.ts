import type { Reel } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { reelTitle } from "@/lib/ui/reelTitle";

interface ReelMetricPoint {
  idx: number;
  postedAt: string;
  title: string;
  avgWatchTimeSec: number;
  durationSec: number;
  // 결손은 0이 아니라 null — 차트에서 갭으로 그려 "데이터없음"과 "0"을 구분한다
  completionRate: number | null;
  skipRate: number | null;
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
  /** 시간순(오래된→최신) 릴스 지표 시리즈 */
  series: ReelMetricPoint[];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeDashboardMetrics(reels: Reel[]): DashboardMetrics {
  const sorted = [...reels].sort((a, b) => a.postedAt.localeCompare(b.postedAt));

  const series: ReelMetricPoint[] = sorted.map((r, i) => {
    const d = computeDerivedRates(r);
    const skipRate = r.skipRateSource === "EDIT"
      ? null
      : r.skipRate != null
        ? r.skipRate
        : (r.hookRetention3s != null ? 100 - r.hookRetention3s : null);
    return {
      idx: i + 1,
      postedAt: r.postedAt.slice(0, 10),
      title: reelTitle(r),
      avgWatchTimeSec: r.avgWatchTimeSec,
      durationSec: r.durationSec,
      completionRate: r.durationSec > 0 ? (d.averageWatchPercentage ?? null) : null,
      skipRate,
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

  return {
    avgWatchTimeSec,
    completionRate,
    avgDurationSec,
    skipRate,
    series,
  };
}
