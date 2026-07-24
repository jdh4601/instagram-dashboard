import type { Reel } from "@/lib/schemas";
import { reelTitle } from "@/lib/ui/reelTitle";
import type { AgeNormalizedViews } from "@/lib/analysis/ageNormalized";

export type ReelSort = "latest" | "views" | "earlyViews" | "hook";

export const SORT_LABELS: Record<ReelSort, string> = {
  latest: "최신순",
  views: "조회수순",
  earlyViews: "48h 조회순",
  hook: "훅순",
};

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
