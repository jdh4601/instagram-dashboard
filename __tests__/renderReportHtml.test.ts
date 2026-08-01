import { renderReportHtml } from "@/lib/report/renderReportHtml";
import type { DailyReport } from "@/lib/report/buildDailyReport";
import type { AccountFunnel, AccountFunnelVerdicts } from "@/lib/analysis/accountFunnel";

const report: DailyReport = {
  date: "2026-07-05",
  metrics: {
    followerCount: 252,
    followerDelta: 12,
    reachLast7d: 1500,
    reelsAnalyzed: 3,
  },
  best: [
    { id: "top", caption: "잘된 릴스", views: 9000, engagementRate: 5.56, permalink: "https://instagram.com/p/top" },
  ],
  worst: [
    { id: "low", caption: "아쉬운 릴스", views: 1000, engagementRate: 1.2 },
  ],
  diagnosis: {
    verdicts: [],
    strengths: [],
    weaknesses: [],
    reelCount: 3,
    summary: "최근 릴스는 참여율이 강점입니다.",
  },
  funnel: null,
  funnelVerdicts: null,
};

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
  deltas: { viewRate: 0.5, followRate: -2.5, linkClickRate: 1.2 },
  applications: null,
  bioApplications: null,
  applyRate: null,
  applicationsByMedium: {},
};

const funnelVerdicts: AccountFunnelVerdicts = {
  viewRate: "strong",
  followRate: "weak",
  linkClickRate: "ok",
};

test("완전한 HTML 문서를 반환", () => {
  const html = renderReportHtml(report);
  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toMatch(/<html[^>]*>/);
  expect(html).toContain("</html>");
});

test("핵심 지표(팔로워 수·증감·날짜)를 렌더", () => {
  const html = renderReportHtml(report);
  expect(html).toContain("252");
  expect(html).toContain("+12"); // 양수 증감은 부호 표시
  expect(html).toContain("2026-07-05");
});

test("팔로워 감소 시 음수 부호로 표시", () => {
  const html = renderReportHtml({ ...report, metrics: { ...report.metrics, followerDelta: -5 } });
  expect(html).toContain("-5");
});

test("베스트/워스트 콘텐츠 섹션은 더 이상 렌더하지 않는다", () => {
  const html = renderReportHtml(report);
  expect(html).not.toContain("잘된 릴스");
  expect(html).not.toContain("아쉬운 릴스");
  expect(html).not.toContain("베스트 콘텐츠");
  expect(html).not.toContain("아쉬운 콘텐츠");
});

test("심층 진단 요약을 렌더", () => {
  const html = renderReportHtml(report);
  expect(html).toContain("최근 릴스는 참여율이 강점입니다.");
});

const threshold = { weakBelow: 0.4, strongAbove: 0.8, weight: 4, label: "공유율" };
const reportWithVerdicts: DailyReport = {
  ...report,
  diagnosis: {
    ...report.diagnosis,
    strengths: [
      { key: "shareRate", label: "공유율", value: 1.23, band: "strong", priorityScore: 0, threshold },
    ],
    weaknesses: [
      {
        key: "hookRetention3s",
        label: "3초 훅 잔존",
        value: 38.5,
        band: "weak",
        priorityScore: 3,
        threshold: { weakBelow: 45, strongAbove: 55, weight: 5, label: "3초 훅 잔존" },
      },
    ],
  },
};

test("강점 지표를 라벨과 수치로 렌더하고 벤치마크 문구는 넣지 않는다", () => {
  const html = renderReportHtml(reportWithVerdicts);
  expect(html).toContain("공유율");
  expect(html).toContain("1.23");
  expect(html).not.toContain("벤치마크");
  expect(html).not.toContain("초과");
});

test("약점 지표를 라벨과 수치로 렌더하고 목표치 문구는 넣지 않는다", () => {
  const html = renderReportHtml(reportWithVerdicts);
  expect(html).toContain("3초 훅 잔존");
  expect(html).toContain("38.50");
  expect(html).not.toContain("미달");
});

test("LLM 총평이 있으면 렌더하고 줄바꿈을 <br>로 변환", () => {
  const html = renderReportHtml({ ...report, narrative: "첫 줄입니다.\n둘째 줄입니다." });
  expect(html).toContain("첫 줄입니다.");
  expect(html).toContain("둘째 줄입니다.");
  expect(html).toContain("<br");
});

test("LLM 총평이 없으면 총평 섹션을 렌더하지 않음", () => {
  const html = renderReportHtml(report);
  expect(html).not.toContain("오늘의 총평");
});

test("총평의 HTML 특수문자를 이스케이프", () => {
  const html = renderReportHtml({ ...report, narrative: "<b>강조</b>" });
  expect(html).not.toContain("<b>강조</b>");
  expect(html).toContain("&lt;b&gt;");
});

test("전환율 섹션에 방문율·팔로우전환율·링크클릭율과 전일 대비 증감을 렌더", () => {
  const html = renderReportHtml({ ...report, funnel, funnelVerdicts });
  expect(html).toContain("전환율");
  expect(html).toContain("8.00"); // viewRate
  expect(html).toContain("15.00"); // followRate
  expect(html).toContain("7.50"); // linkClickRate
  expect(html).toContain("+0.50");
  expect(html).toContain("-2.50");
  expect(html).toContain("+1.20");
});

test("전환율 수치가 긴 소수점이어도 2자리로 반올림해서 렌더", () => {
  const messyFunnel: AccountFunnel = {
    ...funnel,
    viewRate: 13.484111079301462,
    deltas: { ...funnel.deltas, viewRate: 1.0179262310360668 },
  };
  const html = renderReportHtml({ ...report, funnel: messyFunnel, funnelVerdicts });
  expect(html).toContain("13.48");
  expect(html).toContain("+1.02");
  expect(html).not.toContain("13.484111079301462");
  expect(html).not.toContain("1.0179262310360668");
});

test("전환 퍼널 데이터가 없으면 안내 문구를 렌더", () => {
  const html = renderReportHtml(report);
  expect(html).toContain("전환율");
  expect(html).toMatch(/수집되지 않|데이터가 없/);
});
