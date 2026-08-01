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

test("카드는 표시 중인 달과 좌우 이동 버튼을 보여준다", () => {
  const html = renderToStaticMarkup(
    <UploadRhythmCard reels={[reel("2026-07-01T09:00:00+09:00")]} now={NOW} />,
  );

  expect(html).toContain("업로드 리듬");
  expect(html).toContain("2026년 7월");
  expect(html).toContain("이전 달");
  expect(html).toContain("다음 달");
});

test("칸은 종류와 무관하게 초록 한 계열로만 칠한다", () => {
  // 종류마다 색을 다르게 주면 칸마다 색이 튀어 리듬(꾸준함)이 안 보인다.
  const html = renderToStaticMarkup(
    <UploadRhythmCard
      reels={[
        reel("2026-07-01T09:00:00+09:00", { id: "r", mediaType: "REELS" }),
        reel("2026-07-02T09:00:00+09:00", { id: "c", mediaType: "CAROUSEL" }),
      ]}
      now={NOW}
    />,
  );

  expect(html).toContain("bg-rhythm-4");
  expect(html).not.toContain("bg-rhythm-reels");
  expect(html).not.toContain("bg-rhythm-carousel");
});

test("요일은 가로로, 주는 세로로 배열한다", () => {
  const html = renderToStaticMarkup(
    <UploadRhythmCard reels={[reel("2026-07-01T09:00:00+09:00")]} now={NOW} />,
  );

  expect(html).toContain("grid-cols-7");
  const dayOrder = ["일", "월", "화", "수", "목", "금", "토"].map((d) => html.indexOf(`>${d}<`));
  expect(dayOrder.every((index, i) => i === 0 || index > dayOrder[i - 1])).toBe(true);
});

test("요약에 릴스·캐러셀 개수와 업로드일, 최장 공백이 담긴다", () => {
  const html = renderToStaticMarkup(
    <UploadRhythmCard
      reels={[
        reel("2026-07-01T09:00:00+09:00", { id: "a", mediaType: "REELS" }),
        reel("2026-07-03T09:00:00+09:00", { id: "b", mediaType: "CAROUSEL" }),
      ]}
      now={NOW}
    />,
  );

  expect(html).toContain("릴스");
  expect(html).toContain("캐러셀");
  expect(html).toContain("업로드일");
  expect(html).toContain("최장 공백");
});

test("각 칸은 날짜와 업로드 구성을 툴팁으로 알려준다", () => {
  const html = renderToStaticMarkup(
    <UploadRhythmCard
      reels={[reel("2026-07-01T09:00:00+09:00", { views: 2022, mediaType: "REELS" })]}
      now={NOW}
    />,
  );

  expect(html).toContain("7월 1일");
  expect(html).toContain("2,022");
});

test("업로드가 없는 달에도 격자는 남기고 요약으로 알린다", () => {
  // 격자를 통째로 감추면 레이아웃이 튀고, 빈 격자 자체가 "이 달은 쉬었다"는 정보다.
  const html = renderToStaticMarkup(<UploadRhythmCard reels={[]} now={NOW} />);

  expect(html).toContain("업로드 없음");
  expect(html).toContain("업로드 리듬 달력");
});
