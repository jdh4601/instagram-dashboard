import { z } from "zod";
import {
  BREAKDOWN_HOOK_TYPES,
  HOOK_CATEGORY_LABELS,
  type BreakdownHookType,
  type Hook,
} from "@/lib/schemas/hook";
import type { TranscriptLine } from "@/lib/schemas";
import type { VisionImage, VisionModel } from "@/lib/llm/types";
import { taxonomyForPrompt } from "@/lib/reelBreakdown/taxonomy";

const RawBeatSchema = z
  .object({
    start: z.number().nonnegative(),
    end: z.number().positive(),
    label: z.string().trim().min(1).max(80),
    scene: z.string().trim().min(1).max(1200),
    original: z.string().trim().min(1).max(4000),
    translation: z.string().trim().min(1).max(4000),
  })
  .refine((beat) => beat.end > beat.start);

const RawBreakdownSchema = z.object({
  hookType: z.enum(BREAKDOWN_HOOK_TYPES),
  beats: z.array(RawBeatSchema).min(5).max(9),
});

export interface RawBreakdown {
  hookType: BreakdownHookType;
  beats: z.infer<typeof RawBeatSchema>[];
}

const SYSTEM_PROMPT = `너는 숏폼 영상을 사실 기반으로 해체하는 편집 분석가다.
평가·점수·효과 추정·"왜 잘 작동하는지"는 쓰지 않는다. 제공된 음성 자막과 시간표가
붙은 프레임에서 실제로 확인되는 내용만 기록한다.

해야 할 일:
1. 영상을 처음부터 끝까지 이어지는 5~9개 구조 비트로 나눈다.
2. 각 비트에 짧은 한국어 구조 이름, 화면의 사실적 장면 설명, 원문 대사, 자연스러운
   한국어 번역을 쓴다. 영상 속 화면 자막은 scene에 시각적 사실로만 적는다.
3. 첫 구간을 아래 taxonomy 중 가장 가까운 하나로 분류한다. 사용자가 보관함에 붙인
   분류는 참고 정보일 뿐이며, taxonomy 키를 대신하지 않는다.

규칙:
- 첫 비트는 0초에서 시작하고 마지막 비트는 영상 끝까지 덮어라.
- start/end는 자막·컷 시각에 맞춘 초 단위 숫자이며, 겹치거나 역전되면 안 된다.
- original은 해당 구간 자막을 빠뜨리지 말고 원래 언어 그대로 합친다.
- 음성이 이미 한국어면 translation에도 자연스러운 한국어 대사를 쓴다.
- 프레임 사이의 장면을 추측하지 않는다. 보이지 않는 것은 지어내지 않는다.
- 반드시 JSON 객체만 답하고 코드펜스나 설명은 붙이지 않는다.`;

function transcriptText(lines: TranscriptLine[]): string {
  return lines
    .map((line) => `[${line.startSec.toFixed(1)}–${line.endSec.toFixed(1)}] ${line.text}`)
    .join("\n");
}

export function buildBreakdownPrompt(
  hook: Hook,
  transcript: TranscriptLine[],
  durationSec: number,
  cuts: number[],
): { system: string; userText: string } {
  const userText = [
    `원본 릴스: ${hook.sourceUrl ?? "(없음)"}`,
    `사용자가 저장한 훅: ${hook.text}`,
    `사용자가 붙인 보관함 분류: ${HOOK_CATEGORY_LABELS[hook.category]}`,
    `영상 길이: ${durationSec.toFixed(1)}초`,
    `감지된 컷 전환: ${cuts.length > 0 ? cuts.join(", ") : "없음"}`,
    "",
    "## 훅 taxonomy",
    taxonomyForPrompt(),
    "",
    "## 타임스탬프 자막",
    transcriptText(transcript),
    "",
    "이 메시지 뒤에 시간표가 붙은 프레임들이 순서대로 온다.",
    "다음 형태의 JSON으로만 답해라:",
    '{"hookType":"negation","beats":[{"start":0,"end":4.1,"label":"훅","scene":"화자가 정면을 보며 말한다","original":"...","translation":"..."}]}',
  ].join("\n");
  return { system: SYSTEM_PROMPT, userText };
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error("해체 응답에서 JSON 객체를 찾지 못했습니다");
  return text.slice(start, end + 1);
}

/** 시간축 오류는 클립 자르기 전에 잡아, 반쪽짜리 결과 폴더가 남지 않게 한다. */
export function parseBreakdownAnalysis(text: string, durationSec: number): RawBreakdown {
  const parsed = RawBreakdownSchema.parse(JSON.parse(extractJsonObject(text)));
  const beats = parsed.beats;
  if (beats[0].start > 0.5) throw new Error("해체 결과의 첫 구간이 영상 시작을 덮지 않습니다");
  for (let index = 0; index < beats.length; index += 1) {
    const beat = beats[index];
    if (beat.end > durationSec + 0.6) {
      throw new Error(`해체 결과 ${index + 1}번 구간이 영상 길이를 벗어났습니다`);
    }
    const next = beats[index + 1];
    if (next && next.start < beat.end - 0.15) {
      throw new Error(`해체 결과 ${index + 1}번과 ${index + 2}번 구간이 겹칩니다`);
    }
    if (next && next.start > beat.end + 1) {
      throw new Error(`해체 결과 ${index + 1}번과 ${index + 2}번 사이가 비어 있습니다`);
    }
  }
  if (beats.at(-1)!.end < durationSec - 1.5) {
    throw new Error("해체 결과의 마지막 구간이 영상 끝을 덮지 않습니다");
  }
  // ffprobe의 소수점과 모델 반올림이 살짝 다를 수 있다. 실제 파일 끝을 넘지 않게 좁힌다.
  return {
    ...parsed,
    beats: beats.map((beat, index) => ({
      ...beat,
      start: index === 0 ? 0 : beat.start,
      end: Math.min(beat.end, durationSec),
    })),
  };
}

export async function generateBreakdownAnalysis(args: {
  hook: Hook;
  transcript: TranscriptLine[];
  durationSec: number;
  cuts: number[];
  images: VisionImage[];
  model: VisionModel;
}): Promise<RawBreakdown> {
  const prompt = buildBreakdownPrompt(args.hook, args.transcript, args.durationSec, args.cuts);
  const response = await args.model.generate({ ...prompt, images: args.images });
  return parseBreakdownAnalysis(response, args.durationSec);
}
