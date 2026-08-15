import { renderToStaticMarkup } from "react-dom/server";
import { UploadRhythmCard, DayPostsPopover } from "@/components/UploadRhythmCard";
import type { AudienceMix } from "@/lib/analysis/audienceMix";
import type { RhythmDay } from "@/lib/analysis/uploadRhythm";
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

const mix: AudienceMix = {
  followerReach: 227,
  nonFollowerReach: 2847,
  total: 3074,
  nonFollowerShare: 92.62,
  date: "2026-07-30",
};

function render(reels: Reel[], audienceMix: AudienceMix | null = null): string {
  return renderToStaticMarkup(
    <UploadRhythmCard reels={reels} mix={audienceMix} now={NOW} />,
  );
}

test("카드는 표시 중인 달과 좌우 이동 버튼을 보여준다", () => {
  const html = render([reel("2026-07-01T09:00:00+09:00")]);

  expect(html).toContain("업로드 리듬");
  expect(html).toContain("2026년 7월");
  expect(html).toContain("이전 달");
  expect(html).toContain("다음 달");
});

test("도달 구성은 같은 카드 안 달력 위에 있다", () => {
  const html = render([reel("2026-07-01T09:00:00+09:00")], mix);

  // 카드 껍데기는 하나 — 도달 구성과 달력이 따로 놀면 시선이 두 번 끊긴다.
  expect(html.match(/rounded-card/g)?.length).toBe(1);
  expect(html).toContain("도달 구성");
  expect(html).toContain("2,847");
  expect(html.indexOf("도달 구성")).toBeLessThan(html.indexOf("업로드 리듬 달력"));
});

test("도달 구성 데이터가 없으면 달력만 남는다", () => {
  const html = render([reel("2026-07-01T09:00:00+09:00")]);

  expect(html).not.toContain("도달 구성");
  expect(html).toContain("업로드 리듬 달력");
});

test("칸마다 날짜 숫자를 적어 달력으로 읽히게 한다", () => {
  const html = render([reel("2026-07-01T09:00:00+09:00")]);

  expect(html).toContain("grid-cols-7");
  // 잔디가 아니라 달력이다 — 1일부터 31일까지 숫자가 다 있어야 한다.
  for (const day of [1, 15, 31]) expect(html).toContain(`>${day}<`);
  expect(html).not.toContain("bg-rhythm-");
});

test("릴스와 캐러셀은 진한 파랑·연한 파랑 동그라미로 갈린다", () => {
  const html = render([
    reel("2026-07-01T09:00:00+09:00", { id: "r", mediaType: "REELS" }),
    reel("2026-07-02T09:00:00+09:00", { id: "c", mediaType: "CAROUSEL" }),
  ]);

  expect(html).toContain("bg-post-reel");
  expect(html).toContain("bg-post-carousel");
});

test("동그라미는 그날 올린 개수만큼 찍는다", () => {
  const html = render([
    reel("2026-07-01T09:00:00+09:00", { id: "a", mediaType: "REELS" }),
    reel("2026-07-01T12:00:00+09:00", { id: "b", mediaType: "REELS" }),
    reel("2026-07-01T18:00:00+09:00", { id: "c", mediaType: "CAROUSEL" }),
  ]);
  // 아래 요약 줄에도 색 안내 점이 하나씩 붙는다. 빈 달과의 차이가 곧 달력에 찍힌 점이다.
  const empty = render([]);
  const count = (source: string, kind: string) => (source.match(new RegExp(kind, "g")) ?? []).length;

  expect(count(html, "bg-post-reel") - count(empty, "bg-post-reel")).toBe(2);
  expect(count(html, "bg-post-carousel") - count(empty, "bg-post-carousel")).toBe(1);
});

test("요약은 릴스·캐러셀 개수와 업로드일만 말한다", () => {
  const html = render([
    reel("2026-07-01T09:00:00+09:00", { id: "a", mediaType: "REELS" }),
    reel("2026-07-03T09:00:00+09:00", { id: "b", mediaType: "CAROUSEL" }),
  ]);

  expect(html).toContain("릴스 1개");
  expect(html).toContain("캐러셀 1개");
  expect(html).toContain("업로드일 2일");
  expect(html).not.toContain("최장 공백");
});

test("가리키기 전에는 어떤 말풍선도 떠 있지 않다", () => {
  // 이전에 가리킨 칸의 말풍선이 남아 있던 문제. 떠 있는 것은 언제나 하나뿐이어야 한다.
  const html = render([reel("2026-07-01T09:00:00+09:00")]);

  expect(html).not.toContain('role="tooltip"');
});

const day: RhythmDay = {
  date: "2026-07-01",
  day: 1,
  reels: 1,
  carousels: 1,
  views: 1700,
  future: false,
  posts: [
    {
      id: "r1",
      kind: "REELS",
      title: "호날두에게 N억 투자받은 스타트업",
      thumbnailUrl: "https://cdn.example.com/a.jpg",
      views: 1200,
    },
    { id: "c1", kind: "CAROUSEL", title: "제품을 만들기 전에 확인할 5가지", views: 500 },
  ],
};

test("말풍선은 그날 게시물의 썸네일과 제목을 보여준다", () => {
  const html = renderToStaticMarkup(<DayPostsPopover day={day} />);

  expect(html).toContain("7월 1일");
  expect(html).toContain("호날두에게 N억 투자받은 스타트업");
  expect(html).toContain("제품을 만들기 전에 확인할 5가지");
  expect(html).toContain('src="https://cdn.example.com/a.jpg"');
});

test("말풍선은 게시물마다 종류를 알려준다", () => {
  const html = renderToStaticMarkup(<DayPostsPopover day={day} />);

  expect(html).toContain("릴스");
  expect(html).toContain("캐러셀");
});

test("썸네일이 없는 게시물도 자리를 지킨다", () => {
  const html = renderToStaticMarkup(<DayPostsPopover day={day} />);
  const images = html.match(/<img/g) ?? [];

  // 릴스 1건에만 썸네일이 있다. 캐러셀은 빈 자리표시자로 줄 높이를 맞춘다.
  expect(images).toHaveLength(1);
  expect(html).toContain("aspect-[9/16]");
});
