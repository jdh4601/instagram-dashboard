import { selectReels, sortsFor } from "@/lib/ui/reelSelect";
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

describe("캐러셀 목록 정렬", () => {
  // 캐러셀은 도달을 분모로 쓴다. 저장 수가 아니라 저장율로 줄을 세워야
  // 도달이 큰 게시물이 자동으로 위로 올라가는 착시가 없다.
  const carousels: Reel[] = [
    reel({ id: "x", mediaType: "CAROUSEL", reach: 1000, views: 3400, saves: 10, shares: 30 }),
    reel({ id: "y", mediaType: "CAROUSEL", reach: 200, views: 700, saves: 8, shares: 2 }),
    reel({ id: "z", mediaType: "CAROUSEL", reach: 500, views: 1700, saves: 10, shares: 5 }),
  ];

  test("저장율순 — 저장 수가 아니라 도달 대비 비율로 줄 세운다", () => {
    // y 4.0% > z 2.0% > x 1.0% (저장 수로는 x·z가 y보다 많다)
    expect(selectReels(carousels, "", "saveRate").map((r) => r.id)).toEqual(["y", "z", "x"]);
  });

  test("공유율순", () => {
    // x 3.0% > z 1.0% > y 1.0%
    expect(selectReels(carousels, "", "shareRate")[0].id).toBe("x");
  });

  test("도달순", () => {
    expect(selectReels(carousels, "", "reach").map((r) => r.id)).toEqual(["x", "z", "y"]);
  });

  test("캐러셀 정렬 선택지에 영상 문법이 없다", () => {
    const sorts = sortsFor("CAROUSEL");
    expect(sorts).not.toContain("hook"); // 훅 잔존은 영상에만 있다
    expect(sorts).not.toContain("earlyViews");
    expect(sorts).toEqual(["latest", "saveRate", "shareRate", "reach"]);
  });

  test("릴스 정렬 선택지는 그대로다", () => {
    expect(sortsFor("REELS")).toEqual(["latest", "views", "earlyViews", "hook"]);
  });
});
