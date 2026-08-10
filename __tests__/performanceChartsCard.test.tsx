import { renderToStaticMarkup } from "react-dom/server";
import { PerformanceChartsCard } from "@/components/PerformanceChartsCard";
import { PostedReelsTooltip } from "@/components/charts/PostedReelsTooltip";
import { buildPerformanceCharts, type ViewsDayPoint } from "@/lib/analysis/performanceCharts";
import type { AccountSnapshot, Reel } from "@/lib/schemas";

function reel(postedAt: string, views: number, overrides: Partial<Reel> = {}): Reel {
  return {
    id: `reel-${postedAt}`,
    postedAt,
    durationSec: 30,
    views,
    reach: views,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 5,
    ...overrides,
  };
}

function snap(date: string, followerCount: number): AccountSnapshot {
  return { date, followerCount, reachLast7d: 0 };
}

const REELS = [
  reel("2026-06-10T09:00:00+09:00", 3600, { caption: "훅 실험 1" }),
  reel("2026-06-12T09:00:00+09:00", 44000, { caption: "훅 실험 2" }),
];
const SNAPSHOTS = [snap("2026-06-10", 1000), snap("2026-06-12", 1080)];

test("카드는 제목과 네 개 차트를 모두 보여준다", () => {
  const html = renderToStaticMarkup(<PerformanceChartsCard reels={REELS} snapshots={SNAPSHOTS} />);

  expect(html).toContain("Performance charts");
  expect(html).toContain("Views by day");
  expect(html).toContain("Cumulative views");
  expect(html).toContain("Followers gained by day");
  expect(html).toContain("Cumulative followers");
});

test("각 차트에 접근 가능한 제목이 연결된다", () => {
  const html = renderToStaticMarkup(<PerformanceChartsCard reels={REELS} snapshots={SNAPSHOTS} />);

  // 제목 h3의 id를 section이 aria-labelledby로 가리킨다
  expect(html).toContain('aria-labelledby="perf-chart-views-by-day"');
  expect(html).toContain('id="perf-chart-views-by-day"');
  expect(html).toContain('aria-labelledby="perf-chart-cumulative-followers"');
});

test("축 라벨은 실제 시작·끝 날짜를 보여준다", () => {
  const html = renderToStaticMarkup(<PerformanceChartsCard reels={REELS} snapshots={SNAPSHOTS} />);

  expect(html).toContain("2026-06-10");
  expect(html).toContain("2026-06-12");
});

test("이전 기간 토글은 꺼진 상태로 시작한다", () => {
  const html = renderToStaticMarkup(<PerformanceChartsCard reels={REELS} snapshots={SNAPSHOTS} />);

  expect(html).toContain("이전 기간 미표시");
  expect(html).toContain('aria-pressed="false"');
});

test("겹쳐 그릴 이전 기간이 없으면 토글을 누를 수 없다", () => {
  const html = renderToStaticMarkup(<PerformanceChartsCard reels={REELS} snapshots={SNAPSHOTS} />);

  expect(html).toContain("disabled");
});

test("팔로워 데이터만 없으면 그 차트만 안내로 대체한다", () => {
  // 빈 회색 상자가 아니라 왜 비었는지 말해 줘야 한다.
  const html = renderToStaticMarkup(<PerformanceChartsCard reels={REELS} snapshots={[]} />);

  expect(html).toContain("아직 데이터가 없습니다");
  expect(html).toContain("팔로워 스냅샷");
});

test("데이터가 하나도 없으면 카드 전체가 안내가 된다", () => {
  const html = renderToStaticMarkup(<PerformanceChartsCard reels={[]} snapshots={[]} />);

  expect(html).toContain("Performance charts");
  expect(html).toContain("아직 데이터가 없습니다");
  // 빈 축만 남기지 않는다
  expect(html).not.toContain("Cumulative views");
});

function pointOf(date: string, reels: Reel[]): ViewsDayPoint {
  const chart = buildPerformanceCharts(reels, []);
  const point = chart.views.find((item) => item.date === date);
  if (!point) throw new Error(`${date} 구간이 없다`);
  return point;
}

test("툴팁은 그날 게시한 릴스를 썸네일·캡션·원본 링크와 함께 나열한다", () => {
  const point = pointOf("2026-06-10", [
    reel("2026-06-10T09:00:00+09:00", 3600, {
      id: "a",
      caption: "첫 릴스 캡션",
      thumbnailUrl: "https://cdn/a.jpg",
      permalink: "https://instagram.com/reel/a",
    }),
    reel("2026-06-10T20:00:00+09:00", 1200, { id: "b", caption: "둘째 릴스 캡션" }),
  ]);

  const html = renderToStaticMarkup(<PostedReelsTooltip point={point} showPrevious={false} />);

  expect(html).toContain("2026-06-10");
  expect(html).toContain("첫 릴스 캡션");
  expect(html).toContain("둘째 릴스 캡션");
  expect(html).toContain("https://cdn/a.jpg");
  expect(html).toContain("https://instagram.com/reel/a");
  // 하루 합계도 보여준다
  expect(html).toContain("4,800");
});

test("툴팁은 비교가 켜졌을 때만 이전 기간 값을 덧붙인다", () => {
  const point: ViewsDayPoint = {
    date: "2026-06-10",
    views: 100,
    cumulative: 100,
    reels: [],
    prevDate: "2026-06-07",
    prevViews: 40,
    prevCumulative: 40,
  };

  expect(renderToStaticMarkup(<PostedReelsTooltip point={point} showPrevious={false} />)).not.toContain(
    "2026-06-07",
  );
  expect(renderToStaticMarkup(<PostedReelsTooltip point={point} showPrevious />)).toContain("2026-06-07");
});

test("게시가 없는 날 툴팁은 릴스 목록 대신 쉰 날임을 말한다", () => {
  const point = pointOf("2026-06-11", REELS);

  const html = renderToStaticMarkup(<PostedReelsTooltip point={point} showPrevious={false} />);

  expect(html).toContain("게시 없음");
});
