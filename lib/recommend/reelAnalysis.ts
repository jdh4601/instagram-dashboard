import { ReelAnalysisSchema, PRINCIPLE_IDS, type Reel, type ReelAnalysis } from "@/lib/schemas";
import { formatCatalogForPrompt, getStoryFormat } from "@/lib/analysis/storyFormats";
import { computeStorytellingMetrics, describeMetrics } from "@/lib/analysis/storytellingMetrics";
import type { TextModel } from "@/lib/llm/types";

// 탭 하나마다 부르면 같은 자막을 여러 번 보내 비용이 배로 든다. 한 번에 다 받는다.
const SYSTEM_PROMPT = `너는 숏폼 대본을 구조로 해부하는 분석가다. Short Form Academy의
스크립트 체계를 기준으로 삼는다. 감상평이 아니라 구조 진단이 일이다.

## 1) 포맷 분류
아래 10개 포맷 중 이 영상이 어느 것인지 고르고 formatId에 그 id를 그대로 써라.
목록에 없는 id를 지어내면 실패다. 애매하면 confidence를 medium/low로 낮추고
alternateFormatId에 차선 후보를 적어라.

## 2) 비트 대조
고른 포맷의 비트 시퀀스를 기준으로 대본을 훑어라.
- 그 포맷의 **모든 비트를 빠짐없이** beats 배열에 넣어라. 순서도 카탈로그 순서를 지켜라.
- 대본에 실제로 있으면 present=true, startSec/endSec/quote를 자막에서 가져와 채워라.
- 없으면 present=false로 두고 summary에 "무엇이 없어서 무엇이 약해지는지"를 적어라.
- beatId는 반드시 그 포맷의 비트 id여야 한다. 다른 포맷의 비트를 섞지 마라.

## 3) 시크릿 소스
그 포맷을 아웃라이어로 만드는 조건을 기준으로, 지킨 것(secretSauceMet)과
놓친 것(secretSauceMissed)을 각각 한두 문장으로 적어라.

## 4) 8가지 원리 점수
아래 8개를 모두, 지정한 id로, 1~5점으로 매겨라. 하나라도 빠지면 실패다.
- curiosity-contrast (호기심과 대비): 기대와 어긋나는 주장이 있는가. 대비가 클수록 강하다.
- speed-to-value (가치까지의 속도): 5초 안에 "왜 봐야 하는지"가 신호되는가.
- value-density (가치 밀도): 값어치 있는 말과 군더더기의 비율.
- clarity (명료성): 6학년 수준 어휘, 능동태, 짧은 문장으로 이해되는가.
- absorption (흡수율): 예시·비유·프레임워크로 기존 개념을 새로 보게 하는가.
- anticipation (기대감): 다음에 올 것을 예고해 붙잡아 두는가.
- emotional-resonance (감정 공명): 감정을 실어 나르는 단어가 있는가. 공포·충격이 공유를 만든다.
- rhythm (리듬과 완급): 문장 길이가 섞여 있는가. 같은 길이가 이어지면 단조롭다.

점수마다 evidence에는 **자막 인용이나 주어진 수치**를 근거로 넣어라. "무난하다" 같은
막연한 말은 금지다. fix에는 그 원리를 끌어올릴 구체적 조치를 한 문장으로 적어라.

## 규칙
- 근거는 전부 제공된 자막과 수치에서 나와야 한다. 화면·연출·장면을 지어내지 마라.
- hook.line은 자막 첫 구간에 실제로 나온 문장을 그대로 인용해라.
- hook.template은 다른 주제에 갈아 끼울 수 있게 [대괄호]로 빈칸을 파라.
- 한국어로 답하되 formatId·beatId·hook.type·원리 id는 지정한 영문 값만 써라.

hook.type: problem, contrarian, personal-experience, curiosity, result-proof, how-to, other

반드시 아래 형태의 JSON으로만 답하라(설명·코드펜스 금지):
{
  "summary": "이 영상이 어떤 구조로 사람을 붙잡는가 2~3문장",
  "idea": {"coreIdea":"","valueProposition":"","targetAudience":"","differentiator":""},
  "hook": {"line":"","type":"","template":"","why":""},
  "story": {
    "formatId":"", "confidence":"high|medium|low", "rationale":"",
    "alternateFormatId":"(선택)",
    "beats":[{"beatId":"","present":true,"startSec":0,"endSec":0,"summary":"","quote":""}],
    "secretSauceMet":"", "secretSauceMissed":""
  },
  "principles":[{"id":"curiosity-contrast","score":3,"evidence":"","fix":""}]
}`;

function transcriptBlock(reel: Reel): string {
  // 호출 전에 자막 유무를 검사하므로 여기서는 비어 있을 수 없다.
  return (reel.transcript ?? []).map((l) => `[${l.startSec}-${l.endSec}s] ${l.text}`).join("\n");
}

export function buildReelAnalysisPrompt(reel: Reel): { system: string; userText: string } {
  if (!reel.transcript || reel.transcript.length === 0) {
    // 자막 없이 부르면 모델이 캡션만 보고 구조를 지어낸다. 프롬프트를 만들기 전에 막는다.
    throw new Error("자막이 없어 분석할 수 없습니다. 먼저 자동 전사하거나 SRT를 올려 주세요.");
  }

  const metrics = computeStorytellingMetrics(reel);

  const userText = [
    `캡션: ${reel.caption ?? "(없음)"}`,
    ``,
    `## 자막에서 잰 수치 (이 값을 근거로 삼아라)`,
    describeMetrics(metrics),
    ``,
    `## 포맷 카탈로그 (formatId·beatId는 여기서만 고른다)`,
    formatCatalogForPrompt(),
    ``,
    `## 자막`,
    transcriptBlock(reel),
    ``,
    `위 자막과 수치만 근거로 삼아 포맷을 분류하고, 그 포맷의 비트를 빠짐없이 대조하고,`,
    `8가지 원리를 점수와 근거로 매겨 JSON으로 답해줘.`,
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

/**
 * 비트 id가 고른 포맷의 것인지 확인한다.
 *
 * zod는 beatId가 문자열인지만 본다. 다른 포맷의 비트가 섞여 오면 화면이 라벨을
 * 찾지 못해 빈칸이 되므로, 조용히 넘기지 않고 여기서 막는다.
 */
function assertBeatsBelongToFormat(analysis: ReelAnalysis): void {
  const format = getStoryFormat(analysis.story.formatId);
  if (!format) throw new Error(`알 수 없는 포맷입니다: ${analysis.story.formatId}`);

  const known = new Set(format.beats.map((beat) => beat.id));
  const stray = analysis.story.beats.map((beat) => beat.beatId).filter((id) => !known.has(id));
  if (stray.length > 0) {
    throw new Error(`${format.label}에 없는 비트 id입니다: ${stray.join(", ")}`);
  }
}

function assertPrinciplesComplete(analysis: ReelAnalysis): void {
  const seen = new Set(analysis.principles.map((principle) => principle.id));
  const missing = PRINCIPLE_IDS.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw new Error(`원리 점수가 빠졌습니다: ${missing.join(", ")}`);
  }
}

export function parseReelAnalysis(text: string): ReelAnalysis {
  const json: unknown = JSON.parse(extractJsonObject(text));
  const analysis = ReelAnalysisSchema.parse(json);
  assertBeatsBelongToFormat(analysis);
  assertPrinciplesComplete(analysis);
  return analysis;
}

export async function generateReelAnalysis(reel: Reel, model: TextModel): Promise<ReelAnalysis> {
  const { system, userText } = buildReelAnalysisPrompt(reel);
  const text = await model.generate({ system, userText });
  return parseReelAnalysis(text);
}
