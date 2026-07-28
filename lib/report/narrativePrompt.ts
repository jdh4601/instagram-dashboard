import type { DailyReport } from "@/lib/report/buildDailyReport";
import type { MetricVerdict } from "@/lib/analysis/diagnosis";
import type { AccountFunnel, AccountFunnelVerdicts } from "@/lib/analysis/accountFunnel";

export interface NarrativePrompt {
  system: string;
  userText: string;
}

const SYSTEM = `당신은 인스타그램 릴스 계정을 분석하는 한국어 콘텐츠 전략가입니다.
아래 하루치 지표를 읽고, 계정 운영자가 아침에 읽을 "오늘의 총평"을 작성하세요.

작성 규칙:
- 4~6문장의 자연스러운 한국어 문단. 마크다운·불릿·이모지 없이 평문으로.
- 오래된 콘텐츠 나열보다 최근 성과와 전환율(도달→프로필 방문→팔로우/링크클릭)
  변화에 집중해서 해석하세요. 전환율이 왜 오르거나 내렸는지 원인을 추정하세요.
- 심층 진단의 강점/약점 지표에서 얻을 수 있는 교훈을 짚으세요.
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

function formatDeltaPercent(delta: number | null): string {
  if (delta === null) return "데이터 부족";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%p`;
}

const FUNNEL_LABEL = {
  viewRate: "방문율(도달→프로필 방문)",
  followRate: "팔로우 전환율(방문→팔로우)",
  linkClickRate: "링크 클릭율(방문→링크클릭)",
} as const;

function formatFunnel(funnel: AccountFunnel | null, verdicts: AccountFunnelVerdicts | null): string {
  if (!funnel) return "  전환 퍼널 데이터가 아직 수집되지 않았습니다.";
  return (Object.keys(FUNNEL_LABEL) as (keyof typeof FUNNEL_LABEL)[])
    .map((key) => {
      const value = funnel[key];
      const verdict = verdicts?.[key];
      const verdictText = verdict ? ` [${verdict}]` : "";
      return `  - ${FUNNEL_LABEL[key]}: ${value === null ? "데이터 부족" : `${value.toFixed(2)}%`} (전일 대비 ${formatDeltaPercent(funnel.deltas[key])})${verdictText}`;
    })
    .join("\n");
}

export function buildNarrativePrompt(report: DailyReport): NarrativePrompt {
  const { metrics, diagnosis } = report;

  const userText = `[날짜] ${report.date}

[핵심 지표]
- 팔로워: ${metrics.followerCount}명 (전일 대비 ${formatDelta(metrics.followerDelta)})
- 최근 7일 도달: ${metrics.reachLast7d}
- 분석 릴스 수: ${metrics.reelsAnalyzed}개

[전환 퍼널]
${formatFunnel(report.funnel, report.funnelVerdicts)}

[최근 ${diagnosis.reelCount}개 릴스 진단]
잘하고 있는 지표:
${formatVerdicts(diagnosis.strengths)}
개선이 필요한 지표:
${formatVerdicts(diagnosis.weaknesses)}`;

  return { system: SYSTEM, userText };
}
