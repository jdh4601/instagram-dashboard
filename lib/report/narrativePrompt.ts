import type { DailyReport, ReelHighlight } from "@/lib/report/buildDailyReport";
import type { MetricVerdict } from "@/lib/analysis/diagnosis";

export interface NarrativePrompt {
  system: string;
  userText: string;
}

const SYSTEM = `당신은 인스타그램 릴스 계정을 분석하는 한국어 콘텐츠 전략가입니다.
아래 하루치 지표와 콘텐츠 성과를 읽고, 계정 운영자가 아침에 읽을 "오늘의 총평"을 작성하세요.

작성 규칙:
- 4~6문장의 자연스러운 한국어 문단. 마크다운·불릿·이모지 없이 평문으로.
- 단순히 수치를 나열하지 말고, 왜 이런 결과가 나왔는지 원인을 추정하고 해석하세요.
- 베스트/워스트 콘텐츠의 차이에서 얻을 수 있는 교훈을 짚으세요.
- 마지막에 내일 시도해볼 구체적인 액션 1가지를 제안하세요.
- 데이터가 부족한 지표는 단정하지 말고 조심스럽게 표현하세요.`;

function formatDelta(delta: number | null): string {
  if (delta === null) return "데이터 부족";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function formatVerdicts(verdicts: MetricVerdict[]): string {
  if (verdicts.length === 0) return "  (없음)";
  return verdicts
    .map((v) => `  - ${v.label}: ${v.value.toFixed(1)}% (목표 ${v.threshold.weakBelow}~${v.threshold.strongAbove}%)`)
    .join("\n");
}

function formatReels(reels: ReelHighlight[]): string {
  if (reels.length === 0) return "  (없음)";
  return reels
    .map((r) => `  - "${r.caption || "(캡션 없음)"}" — ${r.views} views, 참여율 ${r.engagementRate.toFixed(1)}%`)
    .join("\n");
}

export function buildNarrativePrompt(report: DailyReport): NarrativePrompt {
  const { metrics, diagnosis } = report;

  const userText = `[날짜] ${report.date}

[핵심 지표]
- 팔로워: ${metrics.followerCount}명 (전일 대비 ${formatDelta(metrics.followerDelta)})
- 최근 7일 도달: ${metrics.reachLast7d}
- 분석 릴스 수: ${metrics.reelsAnalyzed}개

[최근 ${diagnosis.reelCount}개 릴스 진단]
잘하고 있는 지표:
${formatVerdicts(diagnosis.strengths)}
개선이 필요한 지표:
${formatVerdicts(diagnosis.weaknesses)}

[베스트 콘텐츠]
${formatReels(report.best)}

[워스트 콘텐츠]
${formatReels(report.worst)}`;

  return { system: SYSTEM, userText };
}
