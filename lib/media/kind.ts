import type { MediaKind, Reel } from "@/lib/schemas";

// mediaType은 선택 필드다. 이 헬퍼를 거쳐 읽어서 `?? "REELS"`가 코드 곳곳에
// 흩어지지 않게 한다.
export function mediaKindOf(reel: Reel): MediaKind {
  return reel.mediaType ?? "REELS";
}
