import type { DailyReport, ReelHighlight } from "@/lib/report/buildDailyReport";
import type { MetricVerdict } from "@/lib/analysis/diagnosis";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : ""; // 음수는 자체 부호 사용
  return `${sign}${delta}`;
}

function deltaColor(delta: number | null): string {
  if (delta === null || delta === 0) return "#6b7280";
  return delta > 0 ? "#16a34a" : "#dc2626";
}

function thumbnail(reel: ReelHighlight): string {
  const box = "width:48px;height:48px;border-radius:6px;display:block;border:1px solid #f1f5f9;";
  const inner = reel.thumbnailUrl
    ? `<img src="${escapeHtml(reel.thumbnailUrl)}" width="48" height="48" alt="" style="${box}object-fit:cover;" />`
    : `<div style="${box}background:#f1f5f9;"></div>`;
  return reel.permalink
    ? `<a href="${escapeHtml(reel.permalink)}" style="text-decoration:none;">${inner}</a>`
    : inner;
}

function highlightRow(reel: ReelHighlight): string {
  const caption = escapeHtml(reel.caption) || "(캡션 없음)";
  const title = reel.permalink
    ? `<a href="${escapeHtml(reel.permalink)}" style="color:#2563eb;text-decoration:none;">${caption}</a>`
    : caption;
  const cell = "padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;vertical-align:top;";
  const reasonLine = reel.reason
    ? `<div style="font-size:12px;color:#9ca3af;margin-top:3px;">${escapeHtml(reel.reason)}</div>`
    : "";
  return `
    <tr>
      <td width="60" style="${cell}padding-right:12px;">${thumbnail(reel)}</td>
      <td style="${cell}color:#111827;">${title}${reasonLine}</td>
      <td style="${cell}color:#374151;text-align:right;white-space:nowrap;">${reel.views.toLocaleString()} views</td>
      <td style="${cell}color:#374151;text-align:right;white-space:nowrap;">참여 ${reel.engagementRate.toFixed(1)}%</td>
    </tr>`;
}

function highlightTable(title: string, reels: ReelHighlight[]): string {
  if (reels.length === 0) {
    return `<h2 style="font-size:16px;color:#111827;margin:24px 0 8px;">${title}</h2>
      <p style="font-size:14px;color:#6b7280;margin:0;">해당하는 릴스가 없습니다.</p>`;
  }
  return `
    <h2 style="font-size:16px;color:#111827;margin:24px 0 8px;">${title}</h2>
    <table style="width:100%;border-collapse:collapse;">${reels.map(highlightRow).join("")}</table>`;
}

interface MetricSub {
  text: string;
  color: string;
}

function verdictRow(verdict: MetricVerdict, kind: "strength" | "weakness"): string {
  const isStrength = kind === "strength";
  const icon = isStrength ? "✅" : "⚠️";
  const target = isStrength
    ? `벤치마크 ${verdict.threshold.strongAbove}% 초과`
    : `목표 ${verdict.threshold.weakBelow}% 미달`;
  const valueColor = isStrength ? "#16a34a" : "#dc2626";
  return `
    <li style="list-style:none;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#374151;">
      ${icon} <b style="color:#111827;">${escapeHtml(verdict.label)}</b>
      <b style="color:${valueColor};">${verdict.value.toFixed(1)}%</b>
      <span style="color:#9ca3af;"> · ${target}</span>
    </li>`;
}

function verdictList(title: string, verdicts: MetricVerdict[], kind: "strength" | "weakness"): string {
  if (verdicts.length === 0) return "";
  return `
    <p style="font-size:13px;font-weight:600;color:#6b7280;margin:12px 0 4px;">${title}</p>
    <ul style="margin:0;padding:0;">${verdicts.map((v) => verdictRow(v, kind)).join("")}</ul>`;
}

function narrativeSection(narrative: string | undefined): string {
  if (!narrative || !narrative.trim()) return "";
  const body = escapeHtml(narrative.trim()).replace(/\n/g, "<br />");
  return `
    <h2 style="font-size:16px;color:#111827;margin:24px 0 8px;">📝 오늘의 총평</h2>
    <p style="font-size:14px;line-height:1.7;color:#374151;margin:0;background:#f5f3ff;padding:14px 16px;border-radius:8px;border-left:3px solid #6d5cc4;">${body}</p>`;
}

function metricCard(label: string, value: string, sub?: MetricSub): string {
  const subLine = sub
    ? `<div style="font-size:13px;color:${sub.color};margin-top:2px;">${escapeHtml(sub.text)}</div>`
    : "";
  return `
    <td style="padding:12px 16px;background:#f8fafc;border-radius:8px;">
      <div style="font-size:12px;color:#6b7280;">${label}</div>
      <div style="font-size:22px;font-weight:700;color:#111827;margin-top:4px;">${value}</div>
      ${subLine}
    </td>`;
}

export function renderReportHtml(report: DailyReport): string {
  const { metrics, diagnosis } = report;
  const delta = metrics.followerDelta;

  const metricsRow = [
    metricCard("팔로워", metrics.followerCount.toLocaleString(), {
      text: `${formatDelta(delta)} (전일 대비)`,
      color: deltaColor(delta),
    }),
    `<td style="width:12px;"></td>`,
    metricCard("최근 7일 도달", metrics.reachLast7d.toLocaleString()),
    `<td style="width:12px;"></td>`,
    metricCard("분석 릴스", `${metrics.reelsAnalyzed}개`),
  ].join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>인스타그램 일일 리포트 · ${escapeHtml(report.date)}</title>
</head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo',sans-serif;color:#111827;">
  <div style="max-width:600px;margin:0 auto;">
    <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">인스타그램 일일 리포트</p>
    <h1 style="font-size:20px;margin:0 0 16px;color:#111827;">${escapeHtml(report.date)}</h1>

    <table style="width:100%;border-collapse:collapse;"><tr>${metricsRow}</tr></table>

    ${narrativeSection(report.narrative)}

    <h2 style="font-size:16px;color:#111827;margin:24px 0 8px;">심층 진단</h2>
    <p style="font-size:14px;line-height:1.6;color:#374151;margin:0;background:#f8fafc;padding:12px 16px;border-radius:8px;">${escapeHtml(diagnosis.summary)}</p>
    ${verdictList("잘하고 있는 지표", diagnosis.strengths, "strength")}
    ${verdictList("개선이 필요한 지표", diagnosis.weaknesses, "weakness")}

    ${highlightTable("🏆 베스트 콘텐츠", report.best)}
    ${highlightTable("📉 아쉬운 콘텐츠", report.worst)}

    <p style="font-size:12px;color:#9ca3af;margin:32px 0 0;">이 리포트는 매일 자동 생성됩니다.</p>
  </div>
</body>
</html>`;
}
