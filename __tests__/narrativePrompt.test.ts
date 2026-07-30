import { buildNarrativePrompt } from "@/lib/report/narrativePrompt";
import type { DailyReport } from "@/lib/report/buildDailyReport";
import type { AccountFunnel, AccountFunnelVerdicts } from "@/lib/analysis/accountFunnel";

const threshold = { weakBelow: 0.4, strongAbove: 0.8, weight: 4, label: "공유율" };

const funnel: AccountFunnel = {
  date: "2026-07-05",
  reach: 1500,
  profileViews: 120,
  follows: 18,
  unfollows: 3,
  netFollows: 15,
  websiteClicks: 9,
  viewRate: 8,
  followRate: 15,
  linkClickRate: 7.5,
  previousDate: "2026-07-04",
  deltas: { viewRate: 0.5, followRate: 2.5, linkClickRate: -1.2 },
};

const funnelVerdicts: AccountFunnelVerdicts = {
  viewRate: "strong",
  followRate: "strong",
  linkClickRate: "weak",
};

const baseReport: DailyReport = {
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
  funnel,
  funnelVerdicts,
};

const report: DailyReport = baseReport;

test("system 프롬프트는 한국어 분석가 역할과 총평 지시를 담는다", () => {
  const { system } = buildNarrativePrompt(report);
  expect(system).toContain("한국어");
  expect(system.length).toBeGreaterThan(30);
});

test("system 프롬프트는 최근 성과와 전환율 중심 코멘트를 지시하고 베스트/워스트 비교는 지시하지 않는다", () => {
  const { system } = buildNarrativePrompt(report);
  expect(system).toContain("전환율");
  expect(system).toContain("최근");
  expect(system).not.toContain("베스트/워스트");
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

test("userText에는 베스트·워스트 콘텐츠 섹션이 더 이상 없다", () => {
  const { userText } = buildNarrativePrompt(report);
  expect(userText).not.toContain("창업 아지트 이야기");
  expect(userText).not.toContain("일단 해보자");
  expect(userText).not.toContain("베스트 콘텐츠");
  expect(userText).not.toContain("워스트 콘텐츠");
});

test("userText에 전환 퍼널 수치와 전일 대비 증감을 소수점 2자리로 포함", () => {
  const { userText } = buildNarrativePrompt(report);
  expect(userText).toContain("8.00"); // viewRate
  expect(userText).toContain("15.00"); // followRate
  expect(userText).toContain("7.50"); // linkClickRate
  expect(userText).toContain("+0.50");
  expect(userText).toContain("+2.50");
  expect(userText).toContain("-1.20");
});

test("전환 퍼널 수치가 긴 소수점이어도 2자리로 반올림", () => {
  const messyFunnel: AccountFunnel = {
    ...funnel,
    viewRate: 13.484111079301462,
    deltas: { ...funnel.deltas, viewRate: 1.0179262310360668 },
  };
  const { userText } = buildNarrativePrompt({ ...baseReport, funnel: messyFunnel });
  expect(userText).toContain("13.48");
  expect(userText).toContain("+1.02");
  expect(userText).not.toContain("13.484111079301462");
  expect(userText).not.toContain("1.0179262310360668");
});

test("퍼널 데이터가 없으면 userText에 데이터 없음 문구를 포함", () => {
  const { userText } = buildNarrativePrompt({ ...baseReport, funnel: null, funnelVerdicts: null });
  expect(userText).toContain("전환 퍼널");
  expect(userText).toMatch(/데이터.*(없|부족|수집되지 않)/);
});
