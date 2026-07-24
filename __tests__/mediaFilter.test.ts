import { filterByMedia, MEDIA_FILTER_LABELS } from "@/lib/ui/mediaFilter";
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
