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

test("강점 지표를 라벨·수치·강점 기준치와 함께 렌더", () => {
  const html = renderReportHtml(reportWithVerdicts);
  expect(html).toContain("공유율");
  expect(html).toContain("1.2"); // value.toFixed(1)
  expect(html).toContain("0.8"); // strongAbove
});

test("약점 지표를 라벨·수치·목표치와 함께 렌더", () => {
  const html = renderReportHtml(reportWithVerdicts);
  expect(html).toContain("3초 훅 잔존");
  expect(html).toContain("38.5");
  expect(html).toContain("45"); // weakBelow
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

test("릴스 선정 이유(reason)를 렌더", () => {
  const html = renderReportHtml({
    ...report,
    best: [{ id: "t", caption: "잘된 릴스", views: 9000, engagementRate: 5.5, reason: "최근 1달 조회수 1위 · 참여율도 평균 이상" }],
  });
  expect(html).toContain("최근 1달 조회수 1위 · 참여율도 평균 이상");
});

test("reason이 없으면 이유 줄을 렌더하지 않는다", () => {
  const html = renderReportHtml({
    ...report,
    worst: [{ id: "w", caption: "이유 없음", views: 1, engagementRate: 0 }],
  });
  expect(html).toContain("이유 없음");
});

test("베스트 릴스에 썸네일 이미지를 렌더", () => {
  const html = renderReportHtml({
    ...report,
    best: [
      { id: "t", caption: "잘된 릴스", views: 9000, engagementRate: 5.56, thumbnailUrl: "https://cdn.example.com/thumb.jpg" },
    ],
  });
  expect(html).toContain("<img");
  expect(html).toContain("https://cdn.example.com/thumb.jpg");
});

test("썸네일이 없으면 깨진 이미지 대신 플레이스홀더를 렌더", () => {
  const html = renderReportHtml({
    ...report,
    best: [{ id: "t", caption: "썸네일 없음", views: 1, engagementRate: 0 }],
  });
  expect(html).not.toContain('src=""');
  expect(html).toContain("썸네일 없음");
});

test("썸네일 URL의 특수문자를 이스케이프", () => {
  const html = renderReportHtml({
    ...report,
    best: [{ id: "t", caption: "x", views: 1, engagementRate: 0, thumbnailUrl: 'https://cdn.example.com/a.jpg?x=1&y="2"' }],
  });
  expect(html).not.toContain('y="2"');
  expect(html).toContain("&amp;");
});

test("HTML 특수문자가 포함된 캡션을 이스케이프", () => {
  const html = renderReportHtml({
    ...report,
    best: [{ id: "x", caption: "<script>alert(1)</script> & \"quote\"", views: 1, engagementRate: 0 }],
  });
  expect(html).not.toContain("<script>alert(1)</script>");
  expect(html).toContain("&lt;script&gt;");
});
