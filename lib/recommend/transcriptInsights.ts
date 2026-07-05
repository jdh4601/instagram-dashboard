import type { Reel, TranscriptInsights } from "@/lib/schemas";
import { TranscriptInsightsSchema } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { BENCHMARKS, type MetricKey } from "@/config/benchmarks";
import type { TextModel } from "@/lib/llm/types";

const SYSTEM_PROMPT = `너는 인스타그램 릴스의 자막(대본)과 성과 지표를 함께 보고
"왜 이 지표가 이렇게 나왔는지"를 자막의 구체적 문장에서 찾아 진단하고,
약점은 자막을 어떻게 고쳐 써야 하는지까지 제안하는 분석가다.

규칙(어기면 실패):
- 영상의 "주제·취지 요약"은 절대 쓰지 마라. (예: "1인 창업가의 이야기를 전하는 콘텐츠" 같은 문장 금지)
- 모든 항목의 detail은 자막의 특정 문장을 큰따옴표로 인용하고, 그 문장이 어떤 지표를 왜 움직였는지 연결해라.
- 제공된 "참여 지표(계정 기준 대비)"의 약점권/중간/강점권 판정을 그대로 신뢰해 강점·약점을 나눠라. "중간 수준" 같은 막연한 표현 금지.
- "급락 구간" 정보가 있으면 그 시점의 자막을 우선 분석 대상으로 삼아라.
- weaknesses의 각 항목에는 "rewrite"를 반드시 포함하라: 그 약점을 고칠 실제 새 자막 대사 1~2줄을 직접 써라(가능하면 [초-초s] 타임스탬프 포함). 일반 조언이 아니라 화면에 그대로 띄울 대사여야 한다.
- strengths에는 rewrite를 넣지 마라.
- 근거(자막 인용)가 없는 항목은 만들지 마라. 강점·약점은 각 1~3개.

반드시 아래 형태의 JSON으로만 답하라(설명·코드펜스 금지):
{
  "summary": "한두 문장 총평(주제 요약 아님 — 무엇이 성과를 갈랐는지)",
  "strengths": [{"title":"짧은 제목","detail":"자막 인용 + 연결 지표로 원인","metric":"지표 키(선택)"}],
  "weaknesses": [{"title":"짧은 제목","detail":"자막 인용 + 연결 지표로 원인","metric":"지표 키(선택)","rewrite":"바로 쓸 새 자막 대사"}]
}
metric 키 예: skipRate(스킵률), completionRate(평균 시청 비율), shareRate(공유율), saveRate(저장율),
commentRate(댓글율), followRate(팔로우전환율).`;

// 지표값을 계정 벤치마크에 비춰 약점권/중간/강점권으로 라벨링. 모델이 직접 "좋다/나쁘다"를 판단하지 않게 한다.
function band(value: number, key: MetricKey): string {
  const t = BENCHMARKS[key];
  const tag = value < t.weakBelow ? "약점권" : value > t.strongAbove ? "강점권" : "중간";
  return `[기준 ${t.weakBelow}↓약점·${t.strongAbove}↑강점 → ${tag}]`;
}

function transcriptBlock(reel: Reel): string {
  if (!reel.transcript || reel.transcript.length === 0) return "(자막 없음)";
  return reel.transcript.map((l) => `[${l.startSec}-${l.endSec}s] ${l.text}`).join("\n");
}

function metricsBlock(reel: Reel): string {
  const d = reel.derived ?? computeDerivedRates(reel);
  const durTxt = reel.durationSec > 0 ? `${reel.durationSec}초` : "미상";
  const skipTxt =
    reel.skipRate != null
      ? `${reel.skipRate}% (3초 잔존 ${(100 - reel.skipRate).toFixed(1)}%)`
      : reel.hookRetention3s != null
        ? `3초 잔존 ${reel.hookRetention3s}%`
        : "미상";
  const hookRet = reel.hookRetention3s ?? (reel.skipRate != null ? 100 - reel.skipRate : null);

  const rows = [
    `영상 길이: ${durTxt}`,
    `조회수: ${reel.views} · 도달: ${reel.reach}`,
    `평균 시청: ${reel.avgWatchTimeSec}초`,
    `3초 스킵/이탈: ${skipTxt}${hookRet != null ? ` ${band(hookRet, "hookRetention3s")}` : ""}`,
    reel.durationSec > 0
      ? `평균 시청 비율: ${d.completionRate.toFixed(1)}% ${band(d.completionRate, "completionRate")}`
      : `완주율: 미상(길이 없음)`,
    ``,
    `참여 지표(계정 기준 대비 — 이 판정을 신뢰할 것):`,
    `  좋아요율 ${d.likeRate.toFixed(2)}% ${band(d.likeRate, "likeRate")}`,
    `  댓글율 ${d.commentRate.toFixed(2)}% ${band(d.commentRate, "commentRate")}`,
    `  저장율 ${d.saveRate.toFixed(2)}% ${band(d.saveRate, "saveRate")}`,
    `  공유율 ${d.shareRate.toFixed(2)}% ${band(d.shareRate, "shareRate")}`,
  ];
  if (d.followRate != null) {
    rows.push(`  팔로우 전환율 ${d.followRate.toFixed(2)}% ${band(d.followRate, "followRate")}`);
  }
  if (reel.followsFromReel != null) rows.push(`이 릴스로 팔로우: ${reel.followsFromReel}명`);
  return rows.join("\n");
}

export function buildTranscriptInsightsPrompt(reel: Reel): { system: string; userText: string } {
  const userText = [
    `캡션: ${reel.caption ?? "(없음)"}`,
    ``,
    `지표:`,
    metricsBlock(reel),
    ``,
    `자막(SRT):`,
    transcriptBlock(reel),
    ``,
    `위 자막의 구체적 문장과 지표 판정을 연결해, 무엇이 성과를 갈랐는지 진단하고`,
    `약점은 새 자막(rewrite)까지 제안해 JSON으로 답해줘. 주제 요약은 금지.`,
  ].join("\n");
  return { system: SYSTEM_PROMPT, userText };
}

// 응답에서 첫 '{' ~ 마지막 '}' 사이만 추출 (코드펜스/잡설 방어)
function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("응답에서 JSON 객체를 찾지 못했습니다");
  }
  return text.slice(start, end + 1);
}

export function parseTranscriptInsights(text: string): TranscriptInsights {
  const json: unknown = JSON.parse(extractJsonObject(text));
  return TranscriptInsightsSchema.parse(json);
}

export async function generateTranscriptInsights(
  reel: Reel,
  model: TextModel,
): Promise<TranscriptInsights> {
  const { system, userText } = buildTranscriptInsightsPrompt(reel);
  const text = await model.generate({ system, userText });
  return parseTranscriptInsights(text);
}
