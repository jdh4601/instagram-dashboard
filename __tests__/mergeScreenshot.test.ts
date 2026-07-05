import { mergeScreenshotParse } from "@/lib/parsing/mergeScreenshot";
import type { Reel, ScreenshotParse } from "@/lib/schemas";

function reel(p: Partial<Reel>): Reel {
  return {
    id: "a",
    postedAt: "2026-06-01T00:00:00+0000",
    durationSec: 0,
    views: 1000,
    reach: 900,
    likes: 10,
    comments: 1,
    saves: 2,
    shares: 3,
    avgWatchTimeSec: 5,
    ...p,
  };
}

test("파싱된 3초 훅·잔존곡선·유입소스를 릴스에 병합", () => {
  const parse: ScreenshotParse = {
    hookRetention3s: 42,
    retentionCurve: [
      { sec: 0, pct: 100 },
      { sec: 3, pct: 42 },
    ],
    reachSources: { reelsTab: 80, explore: 15 },
  };
  const merged = mergeScreenshotParse(reel({}), parse);
  expect(merged.hookRetention3s).toBe(42);
  expect(merged.retentionCurve).toHaveLength(2);
  expect(merged.reachSources?.reelsTab).toBe(80);
});

test("파싱에 없는 필드는 기존 값을 보존", () => {
  const existing = reel({
    hookRetention3s: 50,
    retentionCurve: [{ sec: 0, pct: 100 }],
  });
  const merged = mergeScreenshotParse(existing, { hookRetention3s: 38 });
  expect(merged.hookRetention3s).toBe(38); // 갱신
  expect(merged.retentionCurve).toEqual([{ sec: 0, pct: 100 }]); // 보존
});

test("집계 지표(views 등)는 건드리지 않는다", () => {
  const merged = mergeScreenshotParse(reel({ views: 1000 }), { hookRetention3s: 40 });
  expect(merged.views).toBe(1000);
  expect(merged.id).toBe("a");
});

test("profileVisits를 보존/병합", () => {
  const merged = mergeScreenshotParse(reel({ profileVisits: 120 }), { hookRetention3s: 40 });
  expect(merged.profileVisits).toBe(120);
  expect(mergeScreenshotParse(reel({}), { profileVisits: 80 }).profileVisits).toBe(80);
});

test("skipRate가 주어지면 3초 후 잔존율을 100 - skipRate로 환산", () => {
  const merged = mergeScreenshotParse(reel({}), { skipRate: 68.56 });
  expect(merged.skipRate).toBe(68.56);
  expect(merged.skipRateSource).toBe("EDIT");
  expect(merged.hookRetention3s).toBeCloseTo(31.44, 5);
});

test("hookRetention3s가 직접 주어지면 skipRate 변환보다 우선", () => {
  const merged = mergeScreenshotParse(reel({}), { hookRetention3s: 45, skipRate: 68.56 });
  expect(merged.hookRetention3s).toBe(45);
});
