import { z } from "zod";
import type { Reel } from "@/lib/schemas";
import type { Diagnosis } from "@/lib/analysis/diagnosis";
import type { DropSegment } from "@/lib/analysis/dropDetection";
import type { TextModel } from "@/lib/llm/types";

export const GenerationSchema = z.object({
  hooks: z.array(z.string()).min(1),
  endings: z.array(z.object({ type: z.string(), text: z.string() })).min(1),
  segmentNotes: z.array(
    z.object({
      startSec: z.number(),
      endSec: z.number(),
      comment: z.string(),
      fix: z.string(),
    }),
  ),
  contentComment: z.string(),
});
export type Generation = z.infer<typeof GenerationSchema>;

const SYSTEM_PROMPT = `너는 창업가 인터뷰 릴스를 코칭하는 대본 전문가다.
진단·성과 지표·자막을 근거로 실제로 쓸 수 있는 한국어 대본을 만든다.
반드시 아래 형태의 JSON으로만 답하라(설명·코드펜스 금지):
{
  "hooks": ["0~3초 콜드 오픈 후킹 문장 3안"],
  "endings": [{"type":"여운형|떡밥형|질문형","text":"엔딩 대본"}],
  "segmentNotes": [{"startSec":N,"endSec":N,"comment":"왜 이탈하는지","fix":"구체적 수정안"}],
  "contentComment": "서사·카피에 대한 정성 평가 2~3문장"
}
hooks는 3개, endings는 여운형/떡밥형/질문형 각 1개. segmentNotes는 주어진 급락 구간에 대응.`;

function transcriptBlock(reel: Reel): string {
  if (!reel.transcript || reel.transcript.length === 0) return "(자막 없음)";
  return reel.transcript.map((l) => `[${l.startSec}-${l.endSec}s] ${l.text}`).join("\n");
}

function dropsBlock(drops: DropSegment[]): string {
  if (drops.length === 0) return "(뚜렷한 급락 구간 없음)";
  return drops
    .map((d) => {
      const lines = d.lines.map((l) => l.text).join(" ");
      return `- ${d.startSec}~${d.endSec}초: ${Math.round(d.dropPct)}%p 이탈${lines ? ` — "${lines}"` : ""}`;
    })
    .join("\n");
}

export function buildGenerationPrompt(
  reel: Reel,
  diagnosis: Diagnosis,
  drops: DropSegment[],
): { system: string; userText: string } {
  const bottleneck = diagnosis.bottleneck
    ? `${diagnosis.bottleneck.label} ${diagnosis.bottleneck.value.toFixed(1)}`
    : "없음";
  const weaknesses = diagnosis.weaknesses.map((w) => `${w.label}(${w.value.toFixed(2)})`).join(", ") || "없음";
  const strengths = diagnosis.strengths.map((s) => s.label).join(", ") || "없음";

  const userText = [
    `릴스 길이: ${reel.durationSec}초`,
    `캡션: ${reel.caption ?? "(없음)"}`,
    `이번 병목: ${bottleneck}`,
    `약점: ${weaknesses}`,
    `강점: ${strengths}`,
    ``,
    `자막(SRT):`,
    transcriptBlock(reel),
    ``,
    `잔존 급락 구간:`,
    dropsBlock(drops),
    ``,
    `위 맥락으로 훅 3안, 엔딩 3안(여운형/떡밥형/질문형), 급락 구간별 처방, 콘텐츠 코멘트를 JSON으로 생성해줘.`,
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

export function parseGeneration(text: string): Generation {
  const json: unknown = JSON.parse(extractJsonObject(text));
  return GenerationSchema.parse(json);
}

export async function generateRecommendations(
  reel: Reel,
  diagnosis: Diagnosis,
  drops: DropSegment[],
  model: TextModel,
): Promise<Generation> {
  const { system, userText } = buildGenerationPrompt(reel, diagnosis, drops);
  const text = await model.generate({ system, userText });
  return parseGeneration(text);
}
