import type { ChatTurn } from "@/lib/llm/types";
import type { Reel } from "@/lib/schemas";
import type { HookType, ImprovedStory, ReelAnalysis } from "@/lib/schemas/reelAnalysis";
import { PRINCIPLE_LABELS } from "@/lib/schemas/reelAnalysis";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { diagnose } from "@/lib/analysis/diagnosis";
import { HOOK_TYPE_CATALOG } from "@/lib/analysis/hookCatalog";
import { getBeatSpec, getStoryFormat } from "@/lib/analysis/storyFormats";

/**
 * 모델에 실제로 보내는 대화 창. 저장소는 더 길게 보관하지만(MAX_STORED_MESSAGES),
 * 오래된 턴은 진단에 기여하지 않으면서 컨텍스트 팩을 밀어낸다.
 */
export const MAX_CONTEXT_TURNS = 12;

const ROLE = `당신은 이 인스타그램 계정을 오래 봐 온 콘텐츠 전략가입니다.
운영자가 자기 계정의 상태·병목·개선점을 물으면, 아래 실제 지표에 근거해 진단합니다.`;

const RULES = `답변 규칙:
- 한국어로, 대화하듯 간결하게. 핵심부터 말하고 길게 늘어놓지 마세요.
- 아래 데이터에 있는 숫자만 사용하세요. 데이터가 부족하면 부족하다고 밝히고, 추측이면 추측이라고 말하세요.
- 강점·약점 판정은 반드시 [판정 기준] 표의 임계값으로만 하세요. 대시보드 화면과 다른 결론을 내면 안 됩니다.
- 게시물에 [대본 분석]이 실려 있으면 훅 유형·스토리 포맷·원리 점수를 그대로 인용하세요. 다시 분류하거나
  점수를 새로 매기면 상세 화면과 두 벌이 됩니다. 대본을 고치는 이야기는 빠진 비트와 낮은 원리부터 짚으세요.
- 진단을 요청받으면 병목을 먼저 한 문장으로 짚고, 그 다음에 근거 지표를 대고, 마지막에 이번 주에 실행할 수 있는 구체적인 조치를 제안하세요.
- 일반론("꾸준히 올리세요")이 아니라 이 계정의 숫자에서 나온 이야기를 하세요.

표기법 — 화면이 아래 문법을 카드와 수치 UI로 그립니다. 반드시 이 형태 그대로 쓰세요:
- 섹션 제목: "## 근거"
- 잘되고 있는 점: "[강점] 짧은 제목 :: 한두 문장 설명"  → 초록 카드
- 못하고 있는 점: "[약점] 짧은 제목 :: 한두 문장 설명"  → 빨강 카드
- 기준과 견줄 지표: "[지표] 지표 이름 | 실제값 | 기준값"
  높을수록 좋은 지표에만 쓰세요. 값이 기준 이상이면 초록, 미만이면 빨강으로 칠해집니다.
- 나머지 문장은 평범한 문단이나 "- " 불릿으로 쓰고, 강조는 **굵게**로 합니다. 표는 쓰지 마세요.
- 수치는 "37.33%", "3,360", "8.0초"처럼 단위를 붙여 쓰세요. 증감은 "+9.3%", "-1.09%p"처럼
  부호를 붙이면 오름은 초록, 내림은 빨강으로 표시됩니다.

분량: 강점·약점 카드는 합쳐서 2~4장, [지표]는 3개 안팎, 설명 문장은 짧게. 한 화면에 읽히게 유지하세요.`;

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

// 내부 id를 그대로 실으면 모델이 "contrarian 훅이 좋습니다"처럼 답에 옮겨 적는다.
// 화면이 쓰는 한국어 라벨로 미리 바꿔 둔다.
function hookTypeLabel(type: HookType): string {
  return HOOK_TYPE_CATALOG.find((spec) => spec.id === type)?.label ?? type;
}

function beatLabel(formatId: string, beatId: string): string {
  return getBeatSpec(formatId, beatId)?.label ?? beatId;
}

function formatLabel(formatId: string): string {
  return getStoryFormat(formatId)?.label ?? formatId;
}

function sec(value: number | undefined): string {
  return value === undefined ? "?" : `${value.toFixed(0)}s`;
}

/**
 * 릴스 상세의 분석 탭 4개(요약·아이디어·훅·스토리 포맷·8원리)를 프롬프트에 옮긴다.
 *
 * 자막만 보내면 모델이 훅 유형과 포맷을 그 자리에서 다시 판정해, 대시보드가 이미
 * 매겨 둔 결론과 어긋난 말을 한다. 계정 지표를 화면에서 그대로 가져오는 것과 같은
 * 이유로 대본 분석도 다시 계산하지 않고 캐시된 결과를 싣는다.
 */
function renderAnalysis(analysis: ReelAnalysis): string {
  const { idea, hook, story, principles } = analysis;

  const beats = story.beats.map((beat) => {
    const range = beat.present ? ` (${sec(beat.startSec)}~${sec(beat.endSec)})` : " — 빠짐";
    const quote = beat.quote ? ` 인용: "${beat.quote}"` : "";
    return `      · ${beatLabel(story.formatId, beat.beatId)}${range}: ${beat.summary}${quote}`;
  });

  const scores = principles.map(
    (p) => `      · ${PRINCIPLE_LABELS[p.id]} ${p.score}/5 — ${p.evidence} / 개선: ${p.fix}`,
  );

  return [
    "  대본 분석:",
    `    요약: ${analysis.summary}`,
    `    한 가지 메시지: ${idea.coreIdea}`,
    `    시청자가 얻는 것: ${idea.valueProposition}`,
    `    타깃: ${idea.targetAudience}`,
    `    차별점: ${idea.differentiator}`,
    `    훅 [${hookTypeLabel(hook.type)}]: "${hook.line}"`,
    `      템플릿: ${hook.template}`,
    `      먹힌/안 먹힌 이유: ${hook.why}`,
    `    스토리 포맷: ${formatLabel(story.formatId)} (확신 ${story.confidence}) — ${story.rationale}`,
    `      지킨 조건: ${story.secretSauceMet}`,
    `      놓친 조건: ${story.secretSauceMissed}`,
    "      비트:",
    ...beats,
    "    스크립트 원리 점수 (1~5):",
    ...scores,
  ].join("\n");
}

/** 이미 만들어 둔 개선안. 같은 제안을 모델이 다시 지어내면 화면과 두 벌이 된다. */
function renderImprovedStory(improved: ImprovedStory): string {
  const beats = improved.beats.map(
    (beat) =>
      `      · ${beatLabel(improved.formatId, beat.beatId)} (${beat.startSec.toFixed(0)}~${beat.endSec.toFixed(0)}s, ${beat.origin}): "${beat.line}" — ${beat.note}`,
  );

  return [
    "  개선 전개안:",
    `    포맷 유지: ${formatLabel(improved.formatId)} / 새 훅 유형: ${hookTypeLabel(improved.hookType)}`,
    `    노리는 것: ${improved.premise}`,
    ...beats,
  ].join("\n");
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
    ...(reel.reelAnalysis ? [renderAnalysis(reel.reelAnalysis)] : []),
    ...(reel.improvedStory ? [renderImprovedStory(reel.improvedStory)] : []),
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
