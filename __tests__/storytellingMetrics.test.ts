import { computeStorytellingMetrics, describeMetrics } from "@/lib/analysis/storytellingMetrics";
import type { Reel } from "@/lib/schemas";

function reel(lines: Array<[number, number, string]>, durationSec = 30): Reel {
  return {
    id: "r1",
    postedAt: "2026-06-01T00:00:00Z",
    durationSec,
    views: 100,
    reach: 90,
    likes: 1,
    comments: 0,
    saves: 0,
    shares: 0,
    avgWatchTimeSec: 10,
    transcript: lines.map(([startSec, endSec, text]) => ({ startSec, endSec, text })),
  };
}

test("어절 수와 초당 어절을 센다", () => {
  const m = computeStorytellingMetrics(reel([[0, 2, "월 천만원 버는 사람은"], [2, 4, "이걸 안 합니다"]], 10));

  expect(m.totalWords).toBe(7);
  expect(m.lineCount).toBe(2);
  expect(m.wordsPerSecond).toBeCloseTo(0.7, 2);
});

test("훅 구간은 3초 안에 시작한 줄만 모은다", () => {
  const m = computeStorytellingMetrics(
    reel([
      [0, 2, "첫 줄"],
      [2.5, 4, "훅 안쪽"],
      [3.5, 6, "훅 바깥"],
    ]),
  );

  expect(m.hookText).toContain("첫 줄");
  expect(m.hookText).toContain("훅 안쪽");
  expect(m.hookText).not.toContain("훅 바깥");
});

test("짧은 문장 비율로 스타카토 정도를 잰다", () => {
  // 8어절 이하가 짧은 문장이다. 3줄 중 2줄이 짧으면 0.67.
  const m = computeStorytellingMetrics(
    reel([
      [0, 2, "짧다"],
      [2, 4, "이것도 짧다"],
      [4, 6, "하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열"],
    ]),
  );

  expect(m.staccatoRatio).toBeCloseTo(2 / 3, 2);
});

test("길이가 비슷한 문장이 이어지는 최장 구간을 센다", () => {
  // 같은 길이가 계속되면 리듬이 단조로워진다. 문서가 말하는 '건조기 리듬'이다.
  const m = computeStorytellingMetrics(
    reel([
      [0, 1, "가 나 다"],
      [1, 2, "라 마 바"],
      [2, 3, "사 아 자"],
      [3, 4, "차 카 타 파 하 거 너 더 러 머"],
    ]),
  );

  expect(m.longestMonotoneRun).toBe(3);
});

test("자막이 끝난 뒤 남는 침묵과 최대 공백을 잰다", () => {
  const m = computeStorytellingMetrics(
    reel([
      [0, 2, "처음"],
      [9, 11, "한참 뒤"],
    ], 20),
  );

  expect(m.longestGapSec).toBeCloseTo(7, 2);
  expect(m.trailingSilenceSec).toBeCloseTo(9, 2);
});

test("자막이 없으면 계산하지 않고 던진다", () => {
  expect(() => computeStorytellingMetrics(reel([]))).toThrow(/자막/);
});

test("길이를 모르면 초당 지표를 0으로 두고 나머지는 살린다", () => {
  // durationSec이 0인 릴스가 실제로 있다. 0으로 나눠 NaN을 화면에 흘리면 안 된다.
  const m = computeStorytellingMetrics(reel([[0, 2, "가 나 다"]], 0));

  expect(m.wordsPerSecond).toBe(0);
  expect(m.totalWords).toBe(3);
  expect(Number.isNaN(m.trailingSilenceSec)).toBe(false);
});

test("프롬프트용 요약에 실제 수치가 들어간다", () => {
  const text = describeMetrics(
    computeStorytellingMetrics(reel([[0, 2, "가 나 다"], [2, 4, "라 마 바 사 아 자 차 카 타 파"]], 10)),
  );

  expect(text).toContain("13");
  expect(text).toContain("초당");
});
