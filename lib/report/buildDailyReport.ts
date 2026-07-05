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
  /** 베스트/워스트로 선정된 한 줄 이유 (조회수 순위 + 참여율의 평균 대비 위치). 빌더가 항상 채움 */
  reason?: string;
}

export interface DailyReport {
  date: string;
  metrics: DailyReportMetrics;
  best: ReelHighlight[];
  worst: ReelHighlight[];
  diagnosis: RecentDiagnosis;
  /** LLM이 생성한 정성적 총평(선택). 오케스트레이터에서 주입 */
  narrative?: string;
}

export interface BuildDailyReportOptions {
  /** 베스트/워스트 각각 몇 개까지 뽑을지 (기본 3) */
  topN?: number;
  /** 분석 대상 기간(일). 리포트 날짜 기준 이 일수 이내 업로드된 릴스만 분석 (기본 30 = 최근 1달) */
  windowDays?: number;
}

const DEFAULT_WINDOW_DAYS = 30;

/** 리포트 날짜 기준 windowDays 이내(cutoff 포함)에 업로드된 릴스만 남긴다. */
function withinWindow(reels: Reel[], date: string, windowDays: number): Reel[] {
  const cutoff = new Date(`${date}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  const cutoffMs = cutoff.getTime();
  return reels.filter((reel) => {
    const postedMs = new Date(reel.postedAt).getTime();
    return !Number.isNaN(postedMs) && postedMs >= cutoffMs;
  });
}

function truncateCaption(caption: string | undefined): string {
  if (!caption) return "";
  const oneLine = caption.replace(/\s+/g, " ").trim();
  return oneLine.length > CAPTION_MAX ? `${oneLine.slice(0, CAPTION_MAX)}…` : oneLine;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function bestReason(engagementRate: number, rankIdx: number, avgEngagement: number): string {
  const lead = rankIdx === 0 ? "최근 1달 조회수 1위" : "조회수 상위권";
  const eng = engagementRate >= avgEngagement ? "참여율도 평균 이상" : "다만 참여율은 평균 이하";
  return `${lead} · ${eng}`;
}

function worstReason(engagementRate: number, rankIdx: number, avgEngagement: number): string {
  const lead = rankIdx === 0 ? "최근 1달 조회수 최저" : "조회수 하위권";
  const eng = engagementRate < avgEngagement ? "참여율도 평균 이하" : "그래도 참여율은 평균 이상";
  return `${lead} · ${eng}`;
}

function toHighlight(reel: Reel, reason: string): ReelHighlight {
  return {
    id: reel.id,
    caption: truncateCaption(reel.caption),
    views: reel.views,
    engagementRate: computeDerivedRates(reel).engagementRate,
    thumbnailUrl: reel.thumbnailUrl,
    permalink: reel.permalink,
    reason,
  };
}

export function buildDailyReport(
  reels: Reel[],
  snapshots: AccountSnapshot[],
  date: string,
  options: BuildDailyReportOptions = {},
): DailyReport {
  const topN = options.topN ?? 3;
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const recentReels = withinWindow(reels, date, windowDays);
  const latest = snapshots.length > 0 ? sortByDate(snapshots).at(-1) : undefined;

  const byViewsDesc = [...recentReels].sort((a, b) => b.views - a.views);
  const avgEngagement = average(
    recentReels.map((reel) => computeDerivedRates(reel).engagementRate),
  );
  const best = byViewsDesc
    .slice(0, topN)
    .map((reel, i) => toHighlight(reel, bestReason(computeDerivedRates(reel).engagementRate, i, avgEngagement)));
  const worst = [...byViewsDesc]
    .reverse()
    .slice(0, topN)
    .map((reel, i) => toHighlight(reel, worstReason(computeDerivedRates(reel).engagementRate, i, avgEngagement)));

  return {
    date,
    metrics: {
      followerCount: latest?.followerCount ?? 0,
      followerDelta: latestFollowerDelta(snapshots),
      reachLast7d: latest?.reachLast7d ?? 0,
      reelsAnalyzed: recentReels.length,
    },
    best,
    worst,
    diagnosis: diagnoseRecent(recentReels),
  };
}
