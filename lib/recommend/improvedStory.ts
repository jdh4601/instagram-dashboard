/**
 * 개선된 전개안 생성.
 *
 * `reelAnalysis`가 "무엇이 빠졌나"까지 짚어 주지만, 빠진 자리에 넣을 문장은
 * 카탈로그의 빈칸 템플릿(`[깨달음]을 알게 됐습니다`)이라 그대로는 못 쓴다.
 * 여기서는 이 릴스의 실제 내용으로 그 칸을 채우고, 남은 비트의 순서와 분량까지
 * 다시 배분해 통째로 읽히는 전개를 만든다.
 *
 * 포맷은 분석이 고른 것을 유지한다 — 포맷까지 갈아 끼우면 원본과 나란히 놓고
 * 대조할 수가 없어 "고치는 법"이 아니라 "다시 찍어라"가 된다.
 */

import {
  ImprovedStorySchema,
  type ImprovedStory,
  type Reel,
  type ReelAnalysis,
} from "@/lib/schemas";
import { getStoryFormat, requiredBeats, type StoryFormatSpec } from "@/lib/analysis/storyFormats";
import type { TextModel } from "@/lib/llm/types";

const SYSTEM_PROMPT = `너는 숏폼 스토리텔링 구조를 다시 짜는 대본 편집자다.
주어진 릴스의 자막을 같은 스토리텔링 포맷 안에서 다시 배치해, 빠진 비트를 채우고
분량을 다시 나눈 전개안을 만든다.

반드시 아래 형태의 JSON으로만 답하라(설명·코드펜스 금지):
{
  "formatId": "유지할 포맷 id",
  "premise": "이 재배치가 노리는 것 한 문장",
  "beats": [
    {"beatId":"포맷의 비트 id","line":"그 자리에서 실제로 말할 한국어 문장",
     "startSec":N,"endSec":N,"origin":"kept|rewritten|added","note":"왜 이 문장을 이 자리에 뒀는지"}
  ],
  "changes": ["원본 대비 달라진 점"]
}

규칙:
- formatId는 주어진 것을 그대로 쓴다. 다른 포맷으로 바꾸지 마라.
- 그 포맷의 필수 비트를 하나도 빠뜨리지 마라. 비트 순서는 카탈로그 순서를 따른다.
- beatId는 주어진 목록 밖의 값을 쓰지 마라.
- 타임코드는 0에서 시작해 끊기지 않게 이어 붙이고, 영상 길이를 넘기지 마라.
- line은 빈칸([대괄호])을 남기지 말고 이 릴스의 실제 내용으로 채운 완성 문장이어야 한다.
- origin은 원본 자막을 그대로 살렸으면 kept, 같은 내용을 고쳐 썼으면 rewritten,
  원본에 없던 비트를 새로 넣었으면 added로 적어라.`;

function transcriptBlock(reel: Reel): string {
  if (!reel.transcript || reel.transcript.length === 0) return "(자막 없음)";
  return reel.transcript.map((line) => `[${line.startSec}-${line.endSec}s] ${line.text}`).join("\n");
}

function beatCatalogBlock(format: StoryFormatSpec): string {
  return format.beats
    .map((beat, index) => {
      const optional = beat.optional ? " (선택)" : "";
      return `${index + 1}. ${beat.id} — ${beat.label}${optional}: ${beat.purpose}`;
    })
    .join("\n");
}

/** 분석이 본 현재 상태. 어떤 비트가 비었는지가 이 프롬프트의 핵심 입력이다. */
function currentBeatsBlock(analysis: ReelAnalysis): string {
  return analysis.story.beats
    .map((beat) => `${beat.beatId}: ${beat.present ? "있음" : "없음"} — ${beat.summary}`)
    .join("\n");
}

export function buildImprovedStoryPrompt(
  reel: Reel,
  analysis: ReelAnalysis,
): { system: string; userText: string } {
  const format = getStoryFormat(analysis.story.formatId);
  if (!format) throw new Error(`알 수 없는 포맷입니다: ${analysis.story.formatId}`);

  const userText = [
    `유지할 포맷: ${format.label} (id: ${format.id})`,
    `포맷 설명: ${format.description}`,
    ``,
    `이 포맷의 비트 시퀀스:`,
    beatCatalogBlock(format),
    ``,
    `아웃라이어 조건:`,
    format.secretSauce.map((sauce) => `- ${sauce}`).join("\n"),
    ``,
    `영상 길이: ${reel.durationSec ?? "미상"}초`,
    `훅: ${analysis.hook.line}`,
    `핵심 아이디어: ${analysis.idea.coreIdea}`,
    `타깃: ${analysis.idea.targetAudience}`,
    ``,
    `분석이 본 현재 비트 상태:`,
    currentBeatsBlock(analysis),
    ``,
    `살린 조건: ${analysis.story.secretSauceMet}`,
    `놓친 조건: ${analysis.story.secretSauceMissed}`,
    ``,
    `원본 자막:`,
    transcriptBlock(reel),
    ``,
    `위 맥락으로 같은 포맷(${format.id}) 안에서 개선된 전개안을 JSON으로 만들어라.`,
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

function assertFormatKept(improved: ImprovedStory, analysis: ReelAnalysis): void {
  if (improved.formatId !== analysis.story.formatId) {
    throw new Error(
      `분석이 고른 포맷을 유지해야 합니다: ${analysis.story.formatId} → ${improved.formatId}`,
    );
  }
}

function assertBeatsBelongToFormat(improved: ImprovedStory, format: StoryFormatSpec): void {
  const known = new Set(format.beats.map((beat) => beat.id));
  const stray = improved.beats.map((beat) => beat.beatId).filter((id) => !known.has(id));
  if (stray.length > 0) {
    throw new Error(`${format.label}에 없는 비트 id입니다: ${stray.join(", ")}`);
  }
}

/** 선택 비트는 빠져도 결함이 아니다. 필수 비트만 본다. */
function assertRequiredBeatsPresent(improved: ImprovedStory, format: StoryFormatSpec): void {
  const seen = new Set(improved.beats.map((beat) => beat.beatId));
  const missing = requiredBeats(format)
    .filter((beat) => !seen.has(beat.id))
    .map((beat) => beat.id);
  if (missing.length > 0) {
    throw new Error(`필수 비트가 빠졌습니다: ${missing.join(", ")}`);
  }
}

/**
 * 타임코드는 앞으로만 간다. 뒤섞이면 화면의 타임라인이 겹쳐 그려지고,
 * 영상 길이를 넘으면 존재하지 않는 구간을 가리키게 된다.
 */
function assertTimelineSane(improved: ImprovedStory, reel: Reel): void {
  let cursor = 0;
  for (const beat of improved.beats) {
    if (beat.startSec < cursor || beat.endSec < beat.startSec) {
      throw new Error(`타임코드가 앞뒤로 어긋납니다: ${beat.beatId}`);
    }
    cursor = beat.endSec;
  }

  const duration = reel.durationSec;
  if (duration != null && cursor > duration) {
    throw new Error(`영상 길이(${duration}초)를 넘는 타임코드입니다: ${cursor}초`);
  }
}

export function parseImprovedStory(
  text: string,
  analysis: ReelAnalysis,
  reel: Reel,
): ImprovedStory {
  const json: unknown = JSON.parse(extractJsonObject(text));
  const improved = ImprovedStorySchema.parse(json);

  assertFormatKept(improved, analysis);
  const format = getStoryFormat(improved.formatId);
  if (!format) throw new Error(`알 수 없는 포맷입니다: ${improved.formatId}`);

  assertBeatsBelongToFormat(improved, format);
  assertRequiredBeatsPresent(improved, format);
  assertTimelineSane(improved, reel);
  return improved;
}

export async function generateImprovedStory(
  reel: Reel,
  analysis: ReelAnalysis,
  model: TextModel,
): Promise<ImprovedStory> {
  const { system, userText } = buildImprovedStoryPrompt(reel, analysis);
  const text = await model.generate({ system, userText });
  return parseImprovedStory(text, analysis, reel);
}
