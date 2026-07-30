import { analyzeTranscript } from "@/lib/analysis/transcriptAnalysis";
import type { Reel, TranscriptLine } from "@/lib/schemas";

function reel(p: Partial<Reel> & { id: string }): Reel {
  return {
    postedAt: "2026-06-01T00:00:00Z",
    durationSec: 30,
    views: 1000,
    reach: 1000,
    likes: 20,
    comments: 1,
    saves: 5,
    shares: 4,
    avgWatchTimeSec: 15,
    ...p,
  };
}

function line(startSec: number, endSec: number, text: string): TranscriptLine {
  return { startSec, endSec, text };
}

describe("analyzeTranscript", () => {
  test("훅 자막이 없고 3초 잔존이 낮으면 약점(지표 포함)", () => {
    const r = reel({
      id: "a",
      hookRetention3s: 40,
      transcript: [line(5, 8, "본론으로 들어가서")],
    });
    const a = analyzeTranscript(r);
    const w = a.insights.find((i) => i.kind === "weakness" && i.title.includes("3초"));
    expect(w).toBeDefined();
    expect(w!.detail).toContain("40");
  });

  test("훅 자막이 있고 3초 잔존이 높으면 강점", () => {
    const r = reel({
      id: "b",
      hookRetention3s: 62,
      transcript: [line(0.5, 3, "딱 3초만 보세요")],
    });
    const a = analyzeTranscript(r);
    expect(a.hasHookLine).toBe(true);
    expect(a.insights.some((i) => i.kind === "strength" && i.detail.includes("62"))).toBe(true);
  });

  test("후반 CTA 자막이 없고 저장률이 낮으면 약점", () => {
    // saves 1 / views 1000 → saveRate 0.1% < 0.3 weakBelow
    const r = reel({
      id: "c",
      saves: 1,
      transcript: [line(0.5, 3, "안녕하세요"), line(10, 14, "오늘 내용입니다")],
    });
    const a = analyzeTranscript(r);
    expect(a.hasCta).toBe(false);
    expect(a.insights.some((i) => i.kind === "weakness" && i.title.includes("CTA"))).toBe(true);
  });

  test("후반 CTA 자막이 있고 저장률이 높으면 강점", () => {
    // saves 10 / views 1000 → saveRate 1% > 0.6 strongAbove
    const r = reel({
      id: "d",
      saves: 10,
      durationSec: 20,
      transcript: [line(0.5, 3, "안녕하세요"), line(17, 20, "마음에 들면 저장하세요")],
    });
    const a = analyzeTranscript(r);
    expect(a.hasCta).toBe(true);
    expect(a.insights.some((i) => i.kind === "strength" && i.title.includes("CTA"))).toBe(true);
  });

  test("자막 커버리지(영상 길이 대비)를 계산한다", () => {
    const r = reel({ id: "g", durationSec: 30, transcript: [line(0, 5, "a"), line(10, 15, "b")] });
    const a = analyzeTranscript(r);
    expect(a.coveragePct).toBeCloseTo(50, 5);
  });

  test("후반부 자막이 비고 완주율이 낮으면 약점", () => {
    // avgWatch 6 / duration 30 → completion 20% < 30 weakBelow, coverage 50%
    const r = reel({
      id: "h",
      durationSec: 30,
      avgWatchTimeSec: 6,
      transcript: [line(0, 5, "시작"), line(10, 15, "중간")],
    });
    const a = analyzeTranscript(r);
    expect(a.insights.some((i) => i.kind === "weakness" && i.title.includes("후반"))).toBe(true);
  });

  test("영상 길이 미상(durationSec 0)이면 커버리지는 null이고 후반부 약점을 내지 않는다", () => {
    const r = reel({
      id: "j",
      durationSec: 0,
      avgWatchTimeSec: 7,
      transcript: [line(0, 5, "시작"), line(65, 70, "끝")],
    });
    const a = analyzeTranscript(r);
    expect(a.coveragePct).toBeNull();
    expect(a.insights.some((i) => i.title.includes("후반"))).toBe(false);
  });

  test("자막이 비어 있으면 lineCount 0, insights 빈 배열", () => {
    const a = analyzeTranscript(reel({ id: "i", transcript: [] }));
    expect(a.lineCount).toBe(0);
    expect(a.insights).toEqual([]);
  });
});
