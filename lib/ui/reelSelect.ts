import type { Reel } from "@/lib/schemas";
import { reelTitle } from "@/lib/ui/reelTitle";
import type { AgeNormalizedViews } from "@/lib/analysis/ageNormalized";
import { metricValue } from "@/lib/analysis/metrics";
import type { MediaFilter } from "@/lib/ui/mediaFilter";

export type ReelSort =
  | "latest"
  | "views"
  | "earlyViews"
  | "hook"
  | "saveRate"
  | "shareRate"
  | "reach";

export const SORT_LABELS: Record<ReelSort, string> = {
  latest: "최신순",
  views: "조회수순",
  earlyViews: "48h 조회순",
  hook: "훅순",
  saveRate: "저장율순",
  shareRate: "공유율순",
  reach: "도달순",
};

/**
 * 그 포맷에서 읽을 값이 되는 정렬만 남긴다.
 *
 * 캐러셀에 훅 잔존·48h 조회순을 두면 늘 빈 값으로 줄을 세우게 된다. 반대로 캐러셀이
 * 봐야 하는 건 조회수(노출)가 아니라 도달과 도달 대비 저장·공유다.
 */
const SORTS_BY_FILTER: Record<MediaFilter, ReelSort[]> = {
  REELS: ["latest", "views", "earlyViews", "hook"],
  CAROUSEL: ["latest", "saveRate", "shareRate", "reach"],
  ALL: ["latest", "views", "saveRate", "shareRate"],
};

export function sortsFor(filter: MediaFilter): ReelSort[] {
  return SORTS_BY_FILTER[filter];
}

/** 게시물별 초기 조회수. 값이 없으면 null이 들어온다. */
export type EarlyViewsMap = Record<string, AgeNormalizedViews | null>;

function matches(reel: Reel, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const haystack = `${reelTitle(reel)} ${reel.caption ?? ""}`.toLowerCase();
  return haystack.includes(q);
}

function compare(a: Reel, b: Reel, sort: ReelSort, early?: EarlyViewsMap): number {
  if (sort === "views") return b.views - a.views;
  if (sort === "reach") return b.reach - a.reach;
  if (sort === "saveRate" || sort === "shareRate") {
    // metricValue가 포맷별 분모를 알아서 고른다(캐러셀=도달, 릴스=조회수).
    // 값이 없는 게시물은 뒤로.
    return (metricValue(b, sort) ?? -1) - (metricValue(a, sort) ?? -1);
  }
  if (sort === "earlyViews") {
    // 이력이 없는 게시물은 0으로 취급해 뒤로 보낸다. 목록에서 빼지는 않는다 —
    // 사라지면 사용자가 게시물이 없어진 줄 안다.
    const av = early?.[a.id]?.views ?? -1;
    const bv = early?.[b.id]?.views ?? -1;
    return bv - av;
  }
  if (sort === "hook") {
    // 훅 없는 릴스는 항상 뒤로
    const av = a.hookRetention3s ?? -1;
    const bv = b.hookRetention3s ?? -1;
    return bv - av;
  }
  return b.postedAt.localeCompare(a.postedAt); // latest
}

// 검색(제목·캡션) + 정렬. 순수 — 원본 불변.
export function selectReels(
  reels: Reel[],
  query: string,
  sort: ReelSort,
  early?: EarlyViewsMap,
): Reel[] {
  return reels.filter((r) => matches(r, query)).sort((a, b) => compare(a, b, sort, early));
}
