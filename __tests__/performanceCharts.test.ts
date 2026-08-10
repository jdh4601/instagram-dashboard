import { buildPerformanceCharts } from "@/lib/analysis/performanceCharts";
import type { AccountSnapshot, Reel } from "@/lib/schemas";

function reel(postedAt: string, views: number, overrides: Partial<Reel> = {}): Reel {
  return {
    id: `reel-${postedAt}-${views}`,
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

function dayOf(chart: ReturnType<typeof buildPerformanceCharts>, date: string) {
  const point = chart.views.find((item) => item.date === date);
  if (!point) throw new Error(`${date} 구간이 없다`);
  return point;
}

test("데이터가 없으면 구간도 없고 각 차트가 빈 상태로 표시된다", () => {
  const chart = buildPerformanceCharts([], []);

  expect(chart.range).toBeNull();
  expect(chart.previousRange).toBeNull();
  expect(chart.views).toEqual([]);
  expect(chart.followers).toEqual([]);
  expect(chart.hasViews).toBe(false);
  expect(chart.hasFollowerGain).toBe(false);
  expect(chart.hasFollowerTotal).toBe(false);
});

test("구간은 마지막 데이터 날짜에서 끝나고 기본 30일을 덮는다", () => {
  // 데모·정지된 계정은 오늘 기준 30일에 데이터가 하나도 없다. 오늘에 붙이면
  // 빈 축만 남으므로 마지막 데이터 날짜를 끝으로 잡는다.
  const chart = buildPerformanceCharts(
    [reel("2026-06-01T09:00:00+09:00", 100), reel("2026-06-30T09:00:00+09:00", 200)],
    [],
  );

  expect(chart.range).toEqual({ start: "2026-06-01", end: "2026-06-30", days: 30 });
  expect(chart.views).toHaveLength(30);
});

test("데이터가 30일보다 짧으면 실제 시작 날짜에서 시작한다", () => {
  const chart = buildPerformanceCharts(
    [reel("2026-06-10T09:00:00+09:00", 100), reel("2026-06-12T09:00:00+09:00", 200)],
    [],
  );

  expect(chart.range).toEqual({ start: "2026-06-10", end: "2026-06-12", days: 3 });
});

test("게시가 없는 날은 0 막대가 아니라 빈 자리로 남는다", () => {
  const chart = buildPerformanceCharts(
    [reel("2026-06-10T09:00:00+09:00", 100), reel("2026-06-12T09:00:00+09:00", 200)],
    [],
  );

  expect(dayOf(chart, "2026-06-10").views).toBe(100);
  expect(dayOf(chart, "2026-06-11").views).toBeNull();
  expect(dayOf(chart, "2026-06-12").views).toBe(200);
});

test("같은 날 여러 릴스는 합산하되 툴팁용으로 각각 남는다", () => {
  const chart = buildPerformanceCharts(
    [
      reel("2026-06-10T09:00:00+09:00", 100, { id: "a", caption: "첫 릴스", permalink: "https://ig/a" }),
      reel("2026-06-10T20:00:00+09:00", 250, { id: "b", caption: "둘째 릴스" }),
    ],
    [],
  );

  const day = dayOf(chart, "2026-06-10");
  expect(day.views).toBe(350);
  expect(day.reels).toHaveLength(2);
  expect(day.reels.map((item) => item.title)).toEqual(["첫 릴스", "둘째 릴스"]);
  expect(day.reels[0].permalink).toBe("https://ig/a");
  expect(day.reels[0].views).toBe(100);
});

test("게시 시각은 한국 시간 기준으로 날짜를 가른다", () => {
  // UTC로 끊으면 밤에 올린 릴스가 전날 막대로 밀린다.
  const chart = buildPerformanceCharts([reel("2026-06-10T23:30:00+09:00", 100)], []);

  expect(chart.range?.start).toBe("2026-06-10");
});

test("누적 조회수는 게시 없는 날에도 평평하게 이어진다", () => {
  const chart = buildPerformanceCharts(
    [
      reel("2026-06-10T09:00:00+09:00", 100),
      reel("2026-06-12T09:00:00+09:00", 200),
      reel("2026-06-13T09:00:00+09:00", 50),
    ],
    [],
  );

  expect(chart.views.map((item) => item.cumulative)).toEqual([100, 100, 300, 350]);
});

test("일별 팔로워 증가는 연속한 스냅샷의 차이다", () => {
  const chart = buildPerformanceCharts(
    [],
    [snap("2026-06-10", 1000), snap("2026-06-12", 1080), snap("2026-06-13", 1070)],
  );

  const byDate = new Map(chart.followers.map((item) => [item.date, item]));
  // 첫 스냅샷은 비교 대상이 없어 증가분을 만들 수 없다
  expect(byDate.get("2026-06-10")?.gained).toBeNull();
  expect(byDate.get("2026-06-11")?.gained).toBeNull();
  expect(byDate.get("2026-06-12")?.gained).toBe(80);
  expect(byDate.get("2026-06-13")?.gained).toBe(-10);
});

test("누적 팔로워는 스냅샷의 절대 수치를 그대로 싣는다", () => {
  const chart = buildPerformanceCharts([], [snap("2026-06-10", 1000), snap("2026-06-12", 1080)]);

  const byDate = new Map(chart.followers.map((item) => [item.date, item]));
  expect(byDate.get("2026-06-10")?.total).toBe(1000);
  expect(byDate.get("2026-06-11")?.total).toBeNull();
  expect(byDate.get("2026-06-12")?.total).toBe(1080);
});

test("구간 밖 직전 스냅샷도 첫날 증가분의 기준이 된다", () => {
  // 창을 자른다고 증가분까지 잘리면 첫 막대가 통째로 사라진다.
  const chart = buildPerformanceCharts(
    [],
    [snap("2026-05-01", 900), snap("2026-06-10", 1000), snap("2026-06-12", 1080)],
    { windowDays: 3 },
  );

  expect(chart.range).toEqual({ start: "2026-06-10", end: "2026-06-12", days: 3 });
  const byDate = new Map(chart.followers.map((item) => [item.date, item]));
  expect(byDate.get("2026-06-10")?.gained).toBe(100);
});

test("이전 기간은 직전의 같은 길이 구간이다", () => {
  const chart = buildPerformanceCharts(
    [reel("2026-06-10T09:00:00+09:00", 100), reel("2026-06-12T09:00:00+09:00", 200)],
    [],
  );

  expect(chart.previousRange).toEqual({ start: "2026-06-07", end: "2026-06-09" });
});

test("이전 기간 값은 날짜가 아니라 구간 내 위치로 겹쳐 그린다", () => {
  const chart = buildPerformanceCharts(
    [
      reel("2026-06-07T09:00:00+09:00", 40),
      reel("2026-06-09T09:00:00+09:00", 60),
      reel("2026-06-10T09:00:00+09:00", 100),
      reel("2026-06-12T09:00:00+09:00", 200),
    ],
    [],
    { windowDays: 3 },
  );

  expect(chart.views.map((item) => item.date)).toEqual(["2026-06-10", "2026-06-11", "2026-06-12"]);
  expect(chart.views.map((item) => item.prevDate)).toEqual(["2026-06-07", "2026-06-08", "2026-06-09"]);
  expect(chart.views.map((item) => item.prevViews)).toEqual([40, null, 60]);
  expect(chart.hasPrevious).toBe(true);
});

test("이전 기간 누적은 0에서 다시 시작해야 두 기간을 견줄 수 있다", () => {
  const chart = buildPerformanceCharts(
    [
      reel("2026-06-07T09:00:00+09:00", 40),
      reel("2026-06-09T09:00:00+09:00", 60),
      reel("2026-06-12T09:00:00+09:00", 100),
    ],
    [],
    { windowDays: 3 },
  );

  // 현재 구간 06-10~06-12 / 이전 구간 06-07~06-09 — 둘 다 0에서 출발한다
  expect(chart.views.map((item) => item.cumulative)).toEqual([0, 0, 100]);
  expect(chart.views.map((item) => item.prevCumulative)).toEqual([40, 40, 100]);
});

test("이전 기간에 데이터가 없으면 겹쳐 그릴 것이 없다고 알린다", () => {
  const chart = buildPerformanceCharts([reel("2026-06-10T09:00:00+09:00", 100)], [], { windowDays: 3 });

  expect(chart.hasPrevious).toBe(false);
  expect(chart.views.every((item) => item.prevViews === null)).toBe(true);
});

test("이전 기간 팔로워도 같은 위치에 실린다", () => {
  const chart = buildPerformanceCharts(
    [],
    [snap("2026-06-06", 900), snap("2026-06-07", 940), snap("2026-06-10", 1000), snap("2026-06-12", 1080)],
    { windowDays: 3 },
  );

  const first = chart.followers[0];
  expect(first.date).toBe("2026-06-10");
  expect(first.prevDate).toBe("2026-06-07");
  expect(first.prevGained).toBe(40);
  expect(first.prevTotal).toBe(940);
});

test("차트별 데이터 유무를 따로 알려 준다", () => {
  const onlyReels = buildPerformanceCharts([reel("2026-06-10T09:00:00+09:00", 100)], []);
  expect(onlyReels.hasViews).toBe(true);
  expect(onlyReels.hasFollowerGain).toBe(false);
  expect(onlyReels.hasFollowerTotal).toBe(false);

  const onlySnapshots = buildPerformanceCharts([], [snap("2026-06-10", 1000)]);
  expect(onlySnapshots.hasViews).toBe(false);
  expect(onlySnapshots.hasFollowerTotal).toBe(true);
  // 스냅샷 1건은 차이를 만들 수 없다
  expect(onlySnapshots.hasFollowerGain).toBe(false);
});

test("캡션이 없는 릴스도 툴팁에 붙일 제목을 얻는다", () => {
  const chart = buildPerformanceCharts([reel("2026-06-10T09:00:00+09:00", 100)], []);

  expect(dayOf(chart, "2026-06-10").reels[0].title).toContain("릴스");
});

test("구간을 벗어난 오래된 릴스는 막대에 들어가지 않는다", () => {
  const chart = buildPerformanceCharts(
    [reel("2026-01-01T09:00:00+09:00", 9999), reel("2026-06-10T09:00:00+09:00", 100)],
    [],
    { windowDays: 3 },
  );

  expect(chart.views).toHaveLength(3);
  expect(chart.views.reduce((sum, item) => sum + (item.views ?? 0), 0)).toBe(100);
});
