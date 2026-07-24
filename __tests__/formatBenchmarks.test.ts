import { diagnose } from "@/lib/analysis/diagnosis";
import { buildBaselineThresholds } from "@/lib/analysis/baseline";
import { BENCHMARKS_BY_KIND, CAROUSEL_BENCHMARKS, REELS_BENCHMARKS } from "@/config/benchmarks";
import type { Reel } from "@/lib/schemas";

function carousel(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "c1",
    mediaType: "CAROUSEL",
    postedAt: "2026-07-24T00:00:00Z",
    durationSec: 0,
    views: 470,
    reach: 108,
    likes: 6,
    comments: 1,
    saves: 3,
    shares: 7,
    avgWatchTimeSec: 0,
    ...overrides,
  };
}

function reels(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "r1",
    mediaType: "REELS",
    postedAt: "2026-07-20T00:00:00Z",
    durationSec: 15,
    views: 470,
    reach: 108,
    likes: 6,
    comments: 1,
    saves: 3,
    shares: 7,
    avgWatchTimeSec: 6.5,
    hookRetention3s: 31.5,
    ...overrides,
  };
}

describe("포맷별 임계값 표", () => {
  test("캐러셀 표에는 영상 전용 지표가 없다", () => {
    expect(CAROUSEL_BENCHMARKS.hookRetention3s).toBeUndefined();
    expect(CAROUSEL_BENCHMARKS.completionRate).toBeUndefined();
  });

  test("캐러셀 저장율 기준이 릴스보다 엄격하고 가중치가 가장 높다", () => {
    expect(CAROUSEL_BENCHMARKS.saveRate!.weakBelow).toBeGreaterThan(
      REELS_BENCHMARKS.saveRate.weakBelow,
    );
    // 캐러셀의 1순위 지표는 저장율이다. 공유율보다 무거워야 병목이 바르게 잡힌다.
    expect(CAROUSEL_BENCHMARKS.saveRate!.weight).toBeGreaterThan(
      CAROUSEL_BENCHMARKS.shareRate!.weight,
    );
  });

  test("종류별 표가 모두 등록돼 있다", () => {
    expect(BENCHMARKS_BY_KIND.REELS).toBe(REELS_BENCHMARKS);
    expect(BENCHMARKS_BY_KIND.CAROUSEL).toBe(CAROUSEL_BENCHMARKS);
  });
});

describe("포맷별 진단 (INS-3)", () => {
  test("같은 저장율이 릴스에서는 강점, 캐러셀에서는 약점이다", () => {
    // 저장 3 / 조회 470 = 0.638%
    const asReel = diagnose(reels());
    const asCarousel = diagnose(carousel());

    expect(asReel.strengths.map((v) => v.key)).toContain("saveRate");
    expect(asCarousel.weaknesses.map((v) => v.key)).toContain("saveRate");
  });

  test("캐러셀 병목은 공유율보다 저장율을 먼저 지목한다", () => {
    // 저장율·공유율 모두 하한 대비 같은 비율로 미달시켜 가중치만 겨루게 한다.
    const d = diagnose(carousel({ views: 1000, saves: 5, shares: 2 }));
    expect(d.bottleneck?.key).toBe("saveRate");
  });

  test("캐러셀에는 영상 지표 verdict가 생기지 않는다", () => {
    const keys = diagnose(carousel({ hookRetention3s: 31.5, durationSec: 15 })).verdicts.map(
      (v) => v.key,
    );
    expect(keys).not.toContain("hookRetention3s");
    expect(keys).not.toContain("completionRate");
  });

  test("캐러셀은 프로필 방문율을 진단한다", () => {
    const d = diagnose(carousel({ profileVisits: 1 }));
    // 방문 1 / 도달 108 = 0.93% → 하한 1% 미달
    expect(d.weaknesses.map((v) => v.key)).toContain("profileVisitRate");
  });
});

describe("베이스라인 절대 하한 (INS-3)", () => {
  // 저장율 0.10~0.20% 대에 몰린 캐러셀 이력. 중앙값 0.15% 부근.
  const history: Reel[] = [0.1, 0.12, 0.15, 0.16, 0.18, 0.2].map((rate, i) =>
    carousel({
      id: `h${i}`,
      views: 10000,
      saves: Math.round(rate * 100),
      shares: 40,
      profileVisits: 1,
    }),
  );

  test("베이스라인은 자기 중앙값 기준으로 하한을 낮춘다", () => {
    const t = buildBaselineThresholds(history, "CAROUSEL");
    expect(t).not.toBeNull();
    // 개인화가 실제로 일어나 글로벌 1.0%보다 낮은 하한이 잡힌다.
    expect(t!.saveRate!.weakBelow).toBeLessThan(CAROUSEL_BENCHMARKS.saveRate!.weakBelow);
  });

  test("글로벌 하한 아래 값은 베이스라인이 있어도 강점이 될 수 없다", () => {
    const t = buildBaselineThresholds(history, "CAROUSEL")!;
    // 저장율 0.638% — 자기 중앙값(0.15%)의 4배지만 캐러셀 절대 기준 1%에는 못 미친다.
    const d = diagnose(carousel(), t);
    const save = d.verdicts.find((v) => v.key === "saveRate");

    expect(save).toBeDefined();
    expect(save!.band).not.toBe("strong");
  });

  test("글로벌 하한을 넘으면 베이스라인 강점 판정이 그대로 살아난다", () => {
    const t = buildBaselineThresholds(history, "CAROUSEL")!;
    // 저장 20 / 조회 1000 = 2.0% — 절대 기준도 통과한다.
    const d = diagnose(carousel({ views: 1000, saves: 20 }), t);
    expect(d.verdicts.find((v) => v.key === "saveRate")?.band).toBe("strong");
  });
});
