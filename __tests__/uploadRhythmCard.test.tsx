import { renderToStaticMarkup } from "react-dom/server";
import { UploadRhythmCard } from "@/components/UploadRhythmCard";
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

const NOW = new Date("2026-07-31T00:00:00+09:00");

function render(reels: Reel[]): string {
  return renderToStaticMarkup(<UploadRhythmCard reels={reels} now={NOW} />);
}

test("카드는 표시 중인 달과 좌우 이동 버튼을 보여준다", () => {
  const html = render([reel("2026-07-01T09:00:00+09:00")]);

  expect(html).toContain("업로드 리듬");
  expect(html).toContain("2026년 7월");
  expect(html).toContain("이전 달");
  expect(html).toContain("다음 달");
});

test("칸은 종류와 무관하게 초록 한 계열로만 칠한다", () => {
  // 종류마다 색을 다르게 주면 칸마다 색이 튀어 리듬(꾸준함)이 안 보인다.
  const html = render([
    reel("2026-07-01T09:00:00+09:00", { id: "r", mediaType: "REELS" }),
    reel("2026-07-02T09:00:00+09:00", { id: "c", mediaType: "CAROUSEL" }),
  ]);
  const shades = html.match(/bg-rhythm-[1-4]/g) ?? [];

  // 릴스 하루 + 캐러셀 하루. 둘 다 같은 잔디 계열에서 칠해진다.
  expect(shades).toHaveLength(2);
  expect(html).not.toContain("bg-rhythm-reels");
  expect(html).not.toContain("bg-rhythm-carousel");
});

test("요일은 가로로, 주는 세로로 배열한다", () => {
  const html = render([reel("2026-07-01T09:00:00+09:00")]);

  expect(html).toContain("grid-cols-7");
  const dayOrder = ["일", "월", "화", "수", "목", "금", "토"].map((d) => html.indexOf(`>${d}<`));
  expect(dayOrder.every((index, i) => i === 0 || index > dayOrder[i - 1])).toBe(true);
});

test("달력이 카드 폭을 꽉 채운다", () => {
  // 잔디를 한쪽에 몰아 두면 남는 공간만 커지고 칸은 그대로다.
  const html = render([reel("2026-07-01T09:00:00+09:00")]);

  expect(html).toContain("w-full grid-cols-7");
  expect(html).toContain("aspect-square");
});

test("요약은 릴스·캐러셀 개수와 업로드일만 말한다", () => {
  const html = render([
    reel("2026-07-01T09:00:00+09:00", { id: "a", mediaType: "REELS" }),
    reel("2026-07-03T09:00:00+09:00", { id: "b", mediaType: "CAROUSEL" }),
  ]);

  expect(html).toContain("릴스 1개");
  expect(html).toContain("캐러셀 1개");
  expect(html).toContain("업로드일 2일");
  // 달력이 이미 공백을 보여 주므로 숫자로 또 말하지 않는다.
  expect(html).not.toContain("최장 공백");
  expect(html).not.toContain("많음");
});

test("올린 날은 눌러서도 볼 수 있는 버튼이고, 종류별 개수를 함께 읽어 준다", () => {
  const html = render([
    reel("2026-07-01T09:00:00+09:00", { id: "a", mediaType: "REELS", views: 1200 }),
    reel("2026-07-01T12:00:00+09:00", { id: "b", mediaType: "REELS", views: 822 }),
    reel("2026-07-01T18:00:00+09:00", { id: "c", mediaType: "CAROUSEL", views: 500 }),
  ]);

  // 릴스만·캐러셀만·둘 다를 툴팁 한 줄에서 구분할 수 있어야 한다.
  expect(html).toContain("7월 1일 · 릴스 2 · 캐러셀 1 · 조회 2,522");
  expect(html).toContain("<button");
});

test("올리지 않은 날은 누를 것이 없어 버튼으로 만들지 않는다", () => {
  const html = render([reel("2026-07-01T09:00:00+09:00")]);
  const buttons = html.match(/<button/g) ?? [];

  // 달 이동 2개 + 업로드한 하루치 1개.
  expect(buttons).toHaveLength(3);
});

test("업로드가 없는 달에도 격자는 남기고 요약으로 알린다", () => {
  // 격자를 통째로 감추면 레이아웃이 튀고, 빈 격자 자체가 "이 달은 쉬었다"는 정보다.
  const html = render([]);

  expect(html).toContain("업로드일 0일");
  expect(html).toContain("업로드 리듬 달력");
});
