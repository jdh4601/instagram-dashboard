import { selectReels } from "@/lib/ui/reelSelect";
import type { Reel } from "@/lib/schemas";

function reel(p: Partial<Reel> & { id: string }): Reel {
  return {
    postedAt: "2026-06-01T00:00:00+0000",
    durationSec: 0,
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 0,
    ...p,
  };
}

const reels: Reel[] = [
  reel({ id: "a", caption: "창업 인터뷰 1편", postedAt: "2026-06-01T00:00:00+0000", views: 100, hookRetention3s: 30 }),
  reel({ id: "b", caption: "투자 유치 노하우", postedAt: "2026-06-10T00:00:00+0000", views: 500, hookRetention3s: 60 }),
  reel({ id: "c", caption: "창업가의 하루", postedAt: "2026-06-05T00:00:00+0000", views: 300 }),
];

test("최신순 정렬(기본)", () => {
  const out = selectReels(reels, "", "latest");
  expect(out.map((r) => r.id)).toEqual(["b", "c", "a"]);
});

test("조회수순 정렬", () => {
  const out = selectReels(reels, "", "views");
  expect(out.map((r) => r.id)).toEqual(["b", "c", "a"]);
});

test("훅순 정렬 — 훅 없는 릴스는 뒤로", () => {
  const out = selectReels(reels, "", "hook");
  expect(out.map((r) => r.id)).toEqual(["b", "a", "c"]);
});

test("검색은 캡션/제목을 대소문자 무시로 매칭", () => {
  const out = selectReels(reels, "창업", "latest");
  expect(out.map((r) => r.id).sort()).toEqual(["a", "c"]);
});

test("원본 배열을 변형하지 않는다", () => {
  const copy = [...reels];
  selectReels(reels, "", "views");
  expect(reels).toEqual(copy);
});
