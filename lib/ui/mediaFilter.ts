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

// 목록이 비었을 때 보여줄 문구.
//
// 동기화는 게시물당 Graph 호출 두 번을 순차로 돌려 수십 초가 걸리고, 그동안 목록은
// 동기화 이전 데이터를 그대로 들고 있다. 이때 "동기화해 주세요"라고 안내하면 이미
// 실행 중인 동기화를 사용자가 실패로 오인한다. 진행 중 안내가 필터별 문구보다 앞선다.
export function emptyListMessage(filter: MediaFilter, syncing: boolean): string {
  if (syncing) return "동기화 중입니다. 완료되면 목록이 갱신됩니다.";
  // 목록은 이미 걸러진 채로 들어온다. 전체 필터에서 비었을 때만 저장소가 비었다고
  // 단정할 수 있고, 나머지는 필터 때문일 수도 있어 문구를 나눈다.
  if (filter === "ALL") return "아직 게시물이 없습니다. 상단의 동기화로 Instagram에서 가져오세요.";
  return `${MEDIA_FILTER_LABELS[filter]} 게시물이 없습니다. 다른 종류를 보거나 동기화해 주세요.`;
}
