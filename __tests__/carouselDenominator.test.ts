import { metricValue } from "@/lib/analysis/metrics";
import { diagnose } from "@/lib/analysis/diagnosis";
import { buildBaselineThresholds } from "@/lib/analysis/baseline";
import { CAROUSEL_BENCHMARKS } from "@/config/benchmarks";
import type { Reel } from "@/lib/schemas";

/**
 * 캐러셀 지표의 분모는 도달이다.
 *
 * 캐러셀은 노출(views)이 도달의 3배 안팎으로 부푼다(실측 32건 중앙값 3.4배, 릴스는
 * 1.3배). 조회수를 분모로 쓰면 같은 성과가 릴스보다 3배 작게 나와 캐러셀이 늘 진다.
 * 게다가 프로필 방문율만 도달 분모여서 한 벤치마크 표 안에 두 개의 자가 섞여 있었다.
 */

function post(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "p1",
    postedAt: "2026-07-24T00:00:00Z",
    durationSec: 0,
    views: 1700,
    reach: 500,
    likes: 20,
    comments: 3,
    saves: 10,
    shares: 8,
    avgWatchTimeSec: 0,
    ...overrides,
  };
}

const carousel = (o: Partial<Reel> = {}) => post({ mediaType: "CAROUSEL", ...o });
const reels = (o: Partial<Reel> = {}) => post({ mediaType: "REELS", ...o });

describe("포맷별 지표 분모", () => {
  test("캐러셀 저장율은 도달을 분모로 쓴다", () => {
    // 저장 10 / 도달 500 = 2.0% (조회수 분모였다면 0.588%)
    expect(metricValue(carousel(), "saveRate")).toBeCloseTo(2.0, 5);
  });

  test("릴스 저장율은 조회수 분모 그대로다", () => {
    // 영상은 조회가 곧 소비라 분모가 맞다. 이번 수정이 릴스를 건드리면 안 된다.
    expect(metricValue(reels(), "saveRate")).toBeCloseTo((10 / 1700) * 100, 5);
  });

  test("공유·좋아요·댓글·팔로우도 캐러셀에서는 도달 분모다", () => {
    const c = carousel({ followsFromReel: 5 });
    expect(metricValue(c, "shareRate")).toBeCloseTo(1.6, 5);
    expect(metricValue(c, "likeRate")).toBeCloseTo(4.0, 5);
    expect(metricValue(c, "commentRate")).toBeCloseTo(0.6, 5);
    expect(metricValue(c, "followRate")).toBeCloseTo(1.0, 5);
  });

  test("캐러셀 벤치마크 표는 한 개의 자만 쓴다 — 전부 도달 분모", () => {
    const c = carousel({ profileVisits: 15, followsFromReel: 5 });
    const verdicts = diagnose(c).verdicts;

    expect(verdicts.length).toBeGreaterThan(0);
    for (const v of verdicts) {
      const numerator = {
        saveRate: c.saves,
        shareRate: c.shares,
        likeRate: c.likes,
        commentRate: c.comments,
        profileVisitRate: c.profileVisits!,
        followRate: c.followsFromReel!,
      }[v.key as string];
      expect(numerator).toBeDefined();
      expect(v.value).toBeCloseTo((numerator! / c.reach) * 100, 5);
    }
  });

  test("도달이 0이면 캐러셀 지표는 값이 없다 — 0%로 단정하지 않는다", () => {
    expect(metricValue(carousel({ reach: 0 }), "saveRate")).toBeUndefined();
    expect(diagnose(carousel({ reach: 0 })).verdicts).toHaveLength(0);
  });

  test("노출이 도달의 4배인 실제 캐러셀이 저장율 약점으로 오판되지 않는다", () => {
    // 2026-07-24 게시물 실측: 저장 4 / 도달 247 = 1.62% — 합격선 1%를 넘는다.
    // 조회수(970) 분모로는 0.41%라 약점으로 찍혔다.
    const real = carousel({ reach: 247, views: 970, saves: 4, shares: 9, likes: 8, comments: 1 });
    expect(diagnose(real).weaknesses.map((v) => v.key)).not.toContain("saveRate");
  });

  test("베이스라인도 같은 분모로 내 중앙값을 만든다", () => {
    // 도달 기준 저장율 2.0%로 고른 이력 → 중앙값 2.0%, 하한은 그 85%
    const history = Array.from({ length: 6 }, (_, i) => carousel({ id: `h${i}` }));
    const t = buildBaselineThresholds(history, "CAROUSEL");

    expect(t?.saveRate?.weakBelow).toBeCloseTo(2.0 * 0.85, 5);
  });

  test("라벨이 분모를 밝힌다 — 화면에서 두 자를 구분할 수 있어야 한다", () => {
    expect(CAROUSEL_BENCHMARKS.saveRate!.label).toContain("도달");
    expect(CAROUSEL_BENCHMARKS.shareRate!.label).toContain("도달");
  });
});
