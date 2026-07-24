import { computeDashboardMetrics } from "@/lib/analysis/dashboardMetrics";
import {
  chartCanvasMinWidth,
  formatIndexRanges,
  retentionYMax,
} from "@/components/DashboardMetrics";
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
  reel({
    id: "a",
    postedAt: "2026-06-01T00:00:00+0000",
    durationSec: 30,
    views: 10000,
    reach: 9000,
    avgWatchTimeSec: 22,
    skipRate: 40,
    followsFromReel: 45,
    profileVisits: 180,
  }),
  reel({
    id: "b",
    postedAt: "2026-06-05T00:00:00+0000",
    durationSec: 30,
    views: 5000,
    reach: 4000,
    avgWatchTimeSec: 12,
    skipRate: 65,
    followsFromReel: 20,
    profileVisits: 80,
  }),
];

test("시간순으로 인덱스를 매긴 시리즈를 반환", () => {
  const m = computeDashboardMetrics(reels);
  expect(m.series.map((s) => s.idx)).toEqual([1, 2]);
  expect(m.series[0].completionRate).toBeCloseTo((22 / 30) * 100, 5);
  expect(m.series[1].completionRate).toBeCloseTo((12 / 30) * 100, 5);
});

test("평균 시청 시간과 완시율을 집계", () => {
  const m = computeDashboardMetrics(reels);
  expect(m.avgWatchTimeSec).toBeCloseTo(17, 5);
  expect(m.completionRate).toBeCloseTo(((22 / 30 + 12 / 30) * 100) / 2, 5);
  expect(m.avgDurationSec).toBeCloseTo(30, 5);
});

test("Skip Rate 평균을 집계", () => {
  const m = computeDashboardMetrics(reels);
  expect(m.skipRate).toBeCloseTo(52.5, 5);
});

test("데이터가 비면 null로 안전 처리", () => {
  const m = computeDashboardMetrics([]);
  expect(m.avgWatchTimeSec).toBeNull();
  expect(m.completionRate).toBeNull();
  expect(m.avgDurationSec).toBeNull();
  expect(m.skipRate).toBeNull();
  expect(m.series).toHaveLength(0);
});

test("길이 정보 없으면 완시율 집계에서 제외", () => {
  const r = reel({
    id: "c",
    postedAt: "2026-06-10T00:00:00+0000",
    durationSec: 0,
    views: 1000,
    reach: 900,
    avgWatchTimeSec: 10,
  });
  const m = computeDashboardMetrics([reels[0], r]);
  expect(m.completionRate).toBeCloseTo((22 / 30) * 100, 5);
});

// 0 vs 데이터없음: 결손값은 0이 아니라 null(차트 갭)이어야 한다
test("길이 모르는 릴스의 series 완시율은 0이 아니라 null", () => {
  const r = reel({ id: "c", durationSec: 0, views: 1000, reach: 900, avgWatchTimeSec: 10 });
  const m = computeDashboardMetrics([r]);
  expect(m.series[0].completionRate).toBeNull();
});

test("skip 데이터(skipRate·hook 모두) 없는 릴스의 series skipRate는 null", () => {
  const r = reel({ id: "c", durationSec: 30, views: 1000, reach: 900, avgWatchTimeSec: 10 });
  const m = computeDashboardMetrics([r]);
  expect(m.series[0].skipRate).toBeNull();
});

test("릴스가 적으면 차트가 카드 최소 너비를 유지한다", () => {
  expect(chartCanvasMinWidth(0)).toBe(560);
  expect(chartCanvasMinWidth(8)).toBe(560);
});

test("릴스가 많으면 모든 항목을 스크롤할 수 있도록 캔버스가 늘어난다", () => {
  expect(chartCanvasMinWidth(20)).toBe(960);
  expect(chartCanvasMinWidth(30)).toBe(1440);
});

test("잔존율 미수집 릴스 번호를 연속 구간으로 압축한다", () => {
  expect(formatIndexRanges([6, 2, 1, 5, 4, 3, 10, 12, 11])).toBe("1–6, 10–12");
  expect(formatIndexRanges([])).toBe("");
});

test("잔존율 Y축은 80% 이상 데이터도 잘리지 않도록 동적으로 확장한다", () => {
  expect(retentionYMax([42, 86], 45)).toBe(100);
});

test("잔존율 Y축은 데이터가 없어도 약점 기준선을 포함한다", () => {
  expect(retentionYMax([], 45)).toBeGreaterThanOrEqual(45);
});
