import { renderReportHtml } from "@/lib/report/renderReportHtml";
import type { DailyReport } from "@/lib/report/buildDailyReport";

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

test("베스트/워스트 릴스 캡션과 링크를 렌더", () => {
  const html = renderReportHtml(report);
  expect(html).toContain("잘된 릴스");
  expect(html).toContain("아쉬운 릴스");
  expect(html).toContain("https://instagram.com/p/top");
});

test("심층 진단 요약을 렌더", () => {
  const html = renderReportHtml(report);
  expect(html).toContain("최근 릴스는 참여율이 강점입니다.");
});

test("HTML 특수문자가 포함된 캡션을 이스케이프", () => {
  const html = renderReportHtml({
    ...report,
    best: [{ id: "x", caption: "<script>alert(1)</script> & \"quote\"", views: 1, engagementRate: 0 }],
  });
  expect(html).not.toContain("<script>alert(1)</script>");
  expect(html).toContain("&lt;script&gt;");
});
