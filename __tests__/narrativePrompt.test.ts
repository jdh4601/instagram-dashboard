import { buildNarrativePrompt } from "@/lib/report/narrativePrompt";
import type { DailyReport } from "@/lib/report/buildDailyReport";

const threshold = { weakBelow: 0.4, strongAbove: 0.8, weight: 4, label: "공유율" };

const report: DailyReport = {
  date: "2026-07-05",
  metrics: { followerCount: 252, followerDelta: 11, reachLast7d: 1500, reelsAnalyzed: 14 },
  best: [{ id: "top", caption: "창업 아지트 이야기", views: 12099, engagementRate: 1.9 }],
  worst: [{ id: "low", caption: "일단 해보자", views: 887, engagementRate: 1.9 }],
  diagnosis: {
    verdicts: [],
    strengths: [{ key: "shareRate", label: "공유율", value: 1.2, band: "strong", priorityScore: 0, threshold }],
    weaknesses: [
      { key: "hookRetention3s", label: "3초 훅 잔존", value: 38.5, band: "weak", priorityScore: 3, threshold: { weakBelow: 45, strongAbove: 55, weight: 5, label: "3초 훅 잔존" } },
    ],
    reelCount: 10,
    summary: "강점 1개, 개선 1개.",
  },
};

test("system 프롬프트는 한국어 분석가 역할과 총평 지시를 담는다", () => {
  const { system } = buildNarrativePrompt(report);
  expect(system).toContain("한국어");
  expect(system.length).toBeGreaterThan(30);
});

test("userText에 핵심 지표(팔로워·증감)를 포함", () => {
  const { userText } = buildNarrativePrompt(report);
  expect(userText).toContain("252");
  expect(userText).toContain("11");
});

test("userText에 강점·약점 지표 라벨과 수치를 포함", () => {
  const { userText } = buildNarrativePrompt(report);
  expect(userText).toContain("공유율");
  expect(userText).toContain("3초 훅 잔존");
  expect(userText).toContain("38.5");
});

test("userText에 베스트·워스트 릴스 캡션과 조회수를 포함", () => {
  const { userText } = buildNarrativePrompt(report);
  expect(userText).toContain("창업 아지트 이야기");
  expect(userText).toContain("일단 해보자");
  expect(userText).toContain("12099");
});
