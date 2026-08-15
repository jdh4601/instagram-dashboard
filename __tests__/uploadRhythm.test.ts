import { buildUploadRhythm } from "@/lib/analysis/uploadRhythm";
import type { Reel } from "@/lib/schemas";

function reel(postedAt: string, overrides: Partial<Reel> = {}): Reel {
  return {
    id: `reel-${postedAt}-${overrides.mediaType ?? "REELS"}`,
    postedAt,
    durationSec: 30,
    views: 1000,
    reach: 800,
    likes: 10,
    comments: 1,
    saves: 2,
    shares: 3,
    avgWatchTimeSec: 10,
    hookRetention3s: 40,
    caption: "",
    ...overrides,
  };
}

// 2026년 7월 1일은 수요일이다.
const JULY = { year: 2026, month: 7 };
const NOW = new Date("2026-07-31T00:00:00+09:00");

test("격자는 주(행) × 요일(열)로 만들어지고 날짜는 제자리에 놓인다", () => {
  const rhythm = buildUploadRhythm([reel("2026-07-01T09:00:00+09:00")], JULY, NOW);

  expect(rhythm.weeks[0]).toHaveLength(7);
  // 7/1 수요일 = 요일 인덱스 3, 첫 주 = 열 0
  expect(rhythm.weeks[0][3]?.day).toBe(1);
  expect(rhythm.weeks[0][3]?.reels).toBe(1);
  // 7/1 이전의 일·월·화 칸은 이번 달이 아니므로 비어 있다
  expect(rhythm.weeks[0][0]).toBeNull();
  expect(rhythm.weeks[0][2]).toBeNull();
});

test("업로드가 없는 날은 셀이 있어도 개수가 0이다", () => {
  const rhythm = buildUploadRhythm([reel("2026-07-01T09:00:00+09:00")], JULY, NOW);

  // 7/2 목요일
  expect(rhythm.weeks[0][4]?.day).toBe(2);
  expect(rhythm.weeks[0][4]?.reels).toBe(0);
  expect(rhythm.weeks[0][4]?.carousels).toBe(0);
});

test("릴스와 캐러셀을 따로 센다", () => {
  const rhythm = buildUploadRhythm(
    [
      reel("2026-07-01T09:00:00+09:00", { mediaType: "REELS" }),
      reel("2026-07-03T09:00:00+09:00", { mediaType: "CAROUSEL" }),
      reel("2026-07-06T09:00:00+09:00", { mediaType: "CAROUSEL" }),
    ],
    JULY,
    NOW,
  );

  expect(rhythm.totals.reels).toBe(1);
  expect(rhythm.totals.carousels).toBe(2);
  expect(rhythm.totals.uploadDays).toBe(3);
});

test("한 날에 두 종류가 겹치면 종류별로 따로 센다", () => {
  const rhythm = buildUploadRhythm(
    [
      reel("2026-07-01T09:00:00+09:00", { id: "a", mediaType: "CAROUSEL" }),
      reel("2026-07-01T18:00:00+09:00", { id: "b", mediaType: "CAROUSEL" }),
      reel("2026-07-01T21:00:00+09:00", { id: "c", mediaType: "REELS" }),
    ],
    JULY,
    NOW,
  );

  const cell = rhythm.weeks[0][3];
  expect(cell?.reels).toBe(1);
  expect(cell?.carousels).toBe(2);
  expect(cell?.posts).toHaveLength(3);
});

test("칸마다 그날 올린 게시물을 제목·썸네일까지 싣는다", () => {
  // 달력에서 칸을 가리키면 무엇을 올렸는지 바로 보여줘야 해서, 개수만으로는 부족하다.
  const rhythm = buildUploadRhythm(
    [
      reel("2026-07-01T09:00:00+09:00", {
        id: "r1",
        mediaType: "REELS",
        caption: "호날두에게 N억 투자받은 스타트업\n두 번째 줄",
        thumbnailUrl: "https://cdn.example.com/a.jpg",
        views: 1200,
      }),
    ],
    JULY,
    NOW,
  );

  expect(rhythm.weeks[0][3]?.posts).toEqual([
    {
      id: "r1",
      kind: "REELS",
      title: "호날두에게 N억 투자받은 스타트업",
      thumbnailUrl: "https://cdn.example.com/a.jpg",
      views: 1200,
    },
  ]);
});

test("게시물은 올린 순서대로 담긴다", () => {
  const rhythm = buildUploadRhythm(
    [
      reel("2026-07-01T21:00:00+09:00", { id: "늦게", mediaType: "REELS" }),
      reel("2026-07-01T09:00:00+09:00", { id: "일찍", mediaType: "CAROUSEL" }),
    ],
    JULY,
    NOW,
  );

  expect(rhythm.weeks[0][3]?.posts.map((post) => post.id)).toEqual(["일찍", "늦게"]);
});

test("표시 중인 달의 최장 업로드 공백을 센다", () => {
  // 7/1, 7/10 업로드 → 7/2~7/9 = 8일 공백. 7/11~7/31(21일)이 더 길다.
  const rhythm = buildUploadRhythm(
    [reel("2026-07-01T09:00:00+09:00", { id: "a" }), reel("2026-07-10T09:00:00+09:00", { id: "b" })],
    JULY,
    NOW,
  );

  expect(rhythm.totals.longestGapDays).toBe(21);
});

test("이번 달의 공백은 오늘까지만 센다", () => {
  // 8월 1일에 "최장 공백 30일"이라고 하면 아직 오지 않은 날을 쉰 날로 세는 것이다.
  const rhythm = buildUploadRhythm(
    [reel("2026-08-01T09:00:00+09:00")],
    { year: 2026, month: 8 },
    new Date("2026-08-01T12:00:00+09:00"),
  );

  expect(rhythm.totals.longestGapDays).toBe(0);
  expect(rhythm.totals.uploadDays).toBe(1);
});

test("아직 오지 않은 날은 미래 칸으로 표시한다", () => {
  const rhythm = buildUploadRhythm([], { year: 2026, month: 7 }, new Date("2026-07-10T12:00:00+09:00"));

  expect(rhythm.weeks[1][5]?.day).toBe(10); // 7/10 금요일 = 오늘
  expect(rhythm.weeks[1][5]?.future).toBe(false);
  expect(rhythm.weeks[1][6]?.day).toBe(11);
  expect(rhythm.weeks[1][6]?.future).toBe(true);
});

test("기본 표시 달은 마지막으로 올린 달이다", () => {
  // 이번 달에 아직 안 올렸다고 빈 격자를 먼저 보여주면 카드가 죽은 것처럼 보인다.
  const rhythm = buildUploadRhythm(
    [reel("2026-06-20T09:00:00+09:00"), reel("2026-05-02T09:00:00+09:00", { id: "old" })],
    undefined,
    NOW,
  );

  expect(rhythm.year).toBe(2026);
  expect(rhythm.month).toBe(6);
  expect(rhythm.label).toBe("2026년 6월");
});

test("데이터가 없으면 이번 달을 빈 격자로 보여준다", () => {
  const rhythm = buildUploadRhythm([], undefined, NOW);

  expect(rhythm.month).toBe(7);
  expect(rhythm.totals.uploadDays).toBe(0);
  expect(rhythm.hasPrev).toBe(false);
});

test("이전 달로는 첫 업로드가 있는 달까지만 갈 수 있다", () => {
  const reels = [reel("2026-06-20T09:00:00+09:00"), reel("2026-07-02T09:00:00+09:00", { id: "b" })];

  expect(buildUploadRhythm(reels, JULY, NOW).hasPrev).toBe(true);
  expect(buildUploadRhythm(reels, { year: 2026, month: 6 }, NOW).hasPrev).toBe(false);
});

test("다음 달로는 이번 달까지만 갈 수 있다", () => {
  const reels = [reel("2026-06-20T09:00:00+09:00")];

  expect(buildUploadRhythm(reels, { year: 2026, month: 6 }, NOW).hasNext).toBe(true);
  expect(buildUploadRhythm(reels, JULY, NOW).hasNext).toBe(false);
});

test("자정 근처 게시물은 한국 시간 기준 날짜에 놓인다", () => {
  // 2026-07-02T20:00Z = 한국 7월 3일 05시. UTC로 끊으면 하루 밀려 리듬이 어긋난다.
  const rhythm = buildUploadRhythm([reel("2026-07-02T20:00:00Z")], JULY, NOW);

  expect(rhythm.weeks[0][5]?.day).toBe(3); // 7/3 금요일
  expect(rhythm.weeks[0][5]?.reels).toBe(1);
});
