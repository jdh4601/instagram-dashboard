import type { Reel, AccountSnapshot } from "@/lib/schemas";
import { latestFollowerDelta, sortByDate } from "@/lib/analysis/followerTrend";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { diagnoseRecent, type RecentDiagnosis } from "@/lib/analysis/recentDiagnosis";

const CAPTION_MAX = 80;

export interface DailyReportMetrics {
  /** 최신 스냅샷 기준 팔로워 수 */
  followerCount: number;
  /** 직전 스냅샷 대비 증감. 스냅샷이 2개 미만이면 null */
  followerDelta: number | null;
  /** 최신 스냅샷의 최근 7일 도달 */
  reachLast7d: number;
  /** 분석 대상 릴스 수 */
  reelsAnalyzed: number;
}

export interface ReelHighlight {
  id: string;
  caption: string;
  views: number;
  /** engagementRate = (likes+comments+saves+shares) / views × 100 (앱 규약) */
  engagementRate: number;
  thumbnailUrl?: string;
  permalink?: string;
}

export interface DailyReport {
  date: string;
  metrics: DailyReportMetrics;
  best: ReelHighlight[];
  worst: ReelHighlight[];
  diagnosis: RecentDiagnosis;
}

export interface BuildDailyReportOptions {
  /** 베스트/워스트 각각 몇 개까지 뽑을지 (기본 3) */
  topN?: number;
}

function truncateCaption(caption: string | undefined): string {
  if (!caption) return "";
  const oneLine = caption.replace(/\s+/g, " ").trim();
  return oneLine.length > CAPTION_MAX ? `${oneLine.slice(0, CAPTION_MAX)}…` : oneLine;
}

function toHighlight(reel: Reel): ReelHighlight {
  return {
    id: reel.id,
    caption: truncateCaption(reel.caption),
    views: reel.views,
    engagementRate: computeDerivedRates(reel).engagementRate,
    thumbnailUrl: reel.thumbnailUrl,
    permalink: reel.permalink,
  };
}

export function buildDailyReport(
  reels: Reel[],
  snapshots: AccountSnapshot[],
  date: string,
  options: BuildDailyReportOptions = {},
): DailyReport {
  const topN = options.topN ?? 3;
  const latest = snapshots.length > 0 ? sortByDate(snapshots).at(-1) : undefined;

  const byViewsDesc = [...reels].sort((a, b) => b.views - a.views);
  const best = byViewsDesc.slice(0, topN).map(toHighlight);
  const worst = [...byViewsDesc].reverse().slice(0, topN).map(toHighlight);

  return {
    date,
    metrics: {
      followerCount: latest?.followerCount ?? 0,
      followerDelta: latestFollowerDelta(snapshots),
      reachLast7d: latest?.reachLast7d ?? 0,
      reelsAnalyzed: reels.length,
    },
    best,
    worst,
    diagnosis: diagnoseRecent(reels),
  };
}
