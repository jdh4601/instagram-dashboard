import { emptyListMessage, filterByMedia, MEDIA_FILTER_LABELS } from "@/lib/ui/mediaFilter";
import type { Reel } from "@/lib/schemas";

const base = {
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
  avgWatchTimeSec: 10,
};

const reels: Reel[] = [
  { ...base, id: "레거시" }, // mediaType 없음 = 릴스
  { ...base, id: "릴스", mediaType: "REELS" },
  { ...base, id: "캐러셀", mediaType: "CAROUSEL" },
];

test("REELS 필터는 mediaType이 없는 레거시 데이터도 포함한다", () => {
  expect(filterByMedia(reels, "REELS").map((r) => r.id)).toEqual(["레거시", "릴스"]);
});

test("CAROUSEL 필터는 캐러셀만 돌려준다", () => {
  expect(filterByMedia(reels, "CAROUSEL").map((r) => r.id)).toEqual(["캐러셀"]);
});

test("ALL 필터는 원본 순서 그대로 전부 돌려준다", () => {
  expect(filterByMedia(reels, "ALL").map((r) => r.id)).toEqual(["레거시", "릴스", "캐러셀"]);
});

test("filterByMedia는 원본 배열을 변형하지 않는다", () => {
  const original = [...reels];
  filterByMedia(reels, "CAROUSEL");
  expect(reels).toEqual(original);
});

test("모든 필터에 표시 라벨이 있다", () => {
  expect(MEDIA_FILTER_LABELS.REELS).toBe("릴스");
  expect(MEDIA_FILTER_LABELS.CAROUSEL).toBe("캐러셀");
  expect(MEDIA_FILTER_LABELS.ALL).toBe("전체");
});

// 동기화는 게시물당 Graph 호출이 필요해 수십 초 걸린다. 그 사이 목록은 동기화 이전
// 데이터를 들고 있으므로, 비었다고 "동기화해 주세요"라고 안내하면 이미 실행 중인
// 동기화를 실패로 오인하게 된다(실제 오인 사례에서 나온 회귀 테스트).
test("동기화 중에는 다시 동기화하라고 안내하지 않는다", () => {
  const message = emptyListMessage("CAROUSEL", true);
  expect(message).toContain("동기화 중");
  expect(message).not.toContain("동기화해 주세요");
});

test("동기화 중 안내는 필터 종류와 무관하게 같다", () => {
  expect(emptyListMessage("ALL", true)).toBe(emptyListMessage("REELS", true));
});

test("동기화 중이 아니면 전체 필터는 저장소가 비었다고 안내한다", () => {
  expect(emptyListMessage("ALL", false)).toContain("아직 게시물이 없습니다");
});

test("동기화 중이 아니면 개별 필터는 해당 종류만 비었다고 안내한다", () => {
  expect(emptyListMessage("CAROUSEL", false)).toContain("캐러셀 게시물이 없습니다");
});
