import type { ChatTurn } from "@/lib/llm/types";
import type { Reel } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { diagnose } from "@/lib/analysis/diagnosis";

/**
 * 모델에 실제로 보내는 대화 창. 저장소는 더 길게 보관하지만(MAX_STORED_MESSAGES),
 * 오래된 턴은 진단에 기여하지 않으면서 컨텍스트 팩을 밀어낸다.
 */
export const MAX_CONTEXT_TURNS = 12;

const ROLE = `당신은 이 인스타그램 계정을 오래 봐 온 콘텐츠 전략가입니다.
운영자가 자기 계정의 상태·병목·개선점을 물으면, 아래 실제 지표에 근거해 진단합니다.`;

const RULES = `답변 규칙:
- 한국어로, 대화하듯 간결하게. 마크다운은 굵게(**)와 짧은 불릿(-)까지만 씁니다. 표·제목은 쓰지 마세요.
- 아래 데이터에 있는 숫자만 사용하세요. 데이터가 부족하면 부족하다고 밝히고, 추측이면 추측이라고 말하세요.
- 강점·약점 판정은 반드시 [판정 기준] 표의 임계값으로만 하세요. 대시보드 화면과 다른 결론을 내면 안 됩니다.
- 진단을 요청받으면 병목을 먼저 한 문장으로 짚고, 그 다음에 근거 지표를 대고, 마지막에 이번 주에 실행할 수 있는 구체적인 조치를 제안하세요.
- 일반론("꾸준히 올리세요")이 아니라 이 계정의 숫자에서 나온 이야기를 하세요.
- 길게 늘어놓지 말고 핵심부터 말하세요. 대개 5문장 안팎이면 충분합니다.`;

function renderTranscript(reel: Reel): string {
  if (!reel.transcript || reel.transcript.length === 0) return "  자막: 없음";
  const lines = reel.transcript
    .map((line) => `    [${line.startSec.toFixed(0)}s] ${line.text}`)
    .join("\n");
  return `  자막:\n${lines}`;
}

function renderInsights(reel: Reel): string {
  const insights = reel.transcriptInsights;
  if (!insights) return "";
  const items = [
    ...insights.strengths.map((item) => `    강점 - ${item.title}: ${item.detail}`),
    ...insights.weaknesses.map((item) => `    약점 - ${item.title}: ${item.detail}`),
  ];
  if (items.length === 0) return "";
  return `\n  기존 자막 분석:\n${items.join("\n")}`;
}

function renderReelDetail(reel: Reel): string {
  const derived = computeDerivedRates(reel);
  const { bottleneck, insufficientSample } = diagnose(reel);

  const bottleneckText = insufficientSample
    ? "표본(도달)이 적어 판정 보류"
    : bottleneck
      ? `${bottleneck.label} ${bottleneck.value.toFixed(2)}% (약점 기준 ${bottleneck.threshold.weakBelow})`
      : "뚜렷한 병목 없음";

  return [
    `- id=${reel.id} (${reel.postedAt.slice(0, 10)}) ${reel.caption ?? "(캡션 없음)"}`,
    `  조회 ${reel.views.toLocaleString("ko-KR")} · 도달 ${reel.reach.toLocaleString("ko-KR")} · 좋아요 ${reel.likes} · 댓글 ${reel.comments} · 저장 ${reel.saves} · 공유 ${reel.shares}`,
    `  참여율 ${derived.engagementRate.toFixed(2)}% · 저장율 ${derived.saveRate.toFixed(2)}% · 공유율 ${derived.shareRate.toFixed(2)}% · 평균 시청 ${reel.avgWatchTimeSec.toFixed(1)}초`,
    `  3초 잔존 ${reel.hookRetention3s === undefined ? "데이터 부족" : `${reel.hookRetention3s.toFixed(0)}%`} · 병목: ${bottleneckText}`,
    renderTranscript(reel) + renderInsights(reel),
  ].join("\n");
}

/**
 * 역할 + 계정 컨텍스트 + (지목된 게시물 상세) + 답변 규칙을 하나의 system 문자열로 조립한다.
 * 게시물 상세는 질문이 특정 게시물을 지목했을 때만 붙는다 — 매번 붙이면 컨텍스트가 두 배가 된다.
 */
export function buildChatSystemPrompt(renderedContext: string, mentionedReels: Reel[]): string {
  const sections = [ROLE, "다음은 이 계정의 실제 데이터입니다.", renderedContext];

  if (mentionedReels.length > 0) {
    sections.push(
      ["[지목한 게시물 상세]", ...mentionedReels.map(renderReelDetail)].join("\n"),
    );
  }

  sections.push(RULES);
  return sections.join("\n\n");
}

/** 저장된 대화에서 모델에 보낼 최근 구간만 잘라 낸다. */
export function selectContextTurns(turns: ChatTurn[]): ChatTurn[] {
  return turns.slice(-MAX_CONTEXT_TURNS);
}
