import type { Reel } from "@/lib/schemas";
import { mediaKindOf } from "@/lib/media/kind";

export type MediaFilter = "REELS" | "CAROUSEL" | "ALL";

// 토글 버튼 순서의 단일 출처.
export const MEDIA_FILTER_LABELS: Record<MediaFilter, string> = {
  REELS: "릴스",
  CAROUSEL: "캐러셀",
  ALL: "전체",
};

export function filterByMedia(reels: Reel[], filter: MediaFilter): Reel[] {
  if (filter === "ALL") return [...reels];
  return reels.filter((reel) => mediaKindOf(reel) === filter);
}
