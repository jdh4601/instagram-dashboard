import { createReadStream } from "node:fs";
import OpenAI, { toFile } from "openai";
import { z } from "zod";
import type { TranscriptLine } from "@/lib/schemas";

/**
 * 캐시된 mp4를 OpenAI 전사 API에 보내 자막을 만든다.
 *
 * 수동 SRT 업로드를 대체하지 않는다. 결과를 같은 `reel.transcript` 구조로 저장해서,
 * 자막이 어디서 왔든 기존 분석(급락 구간 매칭·LLM 심층 분석)이 그대로 돈다.
 */

/**
 * whisper-1을 쓰는 이유는 타임스탬프다. 신형 전사 모델(gpt-4o-transcribe 계열)은
 * verbose_json을 지원하지 않아 세그먼트 시각이 없고, 시각이 없으면 훅(0~3초)과
 * 스토리 비트를 자막에서 짚어낼 수 없다.
 */
export const DEFAULT_TRANSCRIPTION_MODEL = "whisper-1";

const WhisperSegmentSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string(),
});

const WhisperResponseSchema = z.object({
  segments: z.array(WhisperSegmentSchema).optional(),
});

/** 초 단위를 0.1초로 반올림. SRT 업로드 경로와 정밀도를 맞춘다. */
const round1 = (value: number): number => Math.round(value * 10) / 10;

export function parseWhisperResponse(raw: unknown): TranscriptLine[] {
  const parsed = WhisperResponseSchema.parse(raw);
  if (!parsed.segments) {
    throw new Error(
      "전사 응답에 세그먼트가 없습니다. 타임스탬프를 주는 모델(whisper-1)인지 확인해 주세요.",
    );
  }
  const lines = parsed.segments
    .map((segment) => ({
      startSec: round1(segment.start),
      endSec: round1(segment.end),
      text: segment.text.trim(),
    }))
    .filter((line) => line.text.length > 0);

  if (lines.length === 0) {
    throw new Error("영상에서 말을 인식하지 못했습니다. 음성이 없는 영상일 수 있어요.");
  }
  return lines;
}

/** 테스트 주입용 최소 인터페이스 (OpenAI SDK의 audio.transcriptions.create 부분만) */
interface TranscriptionClientLike {
  audio: {
    transcriptions: {
      create(args: unknown): Promise<unknown>;
    };
  };
}

interface TranscribeOptions {
  apiKey?: string;
  model?: string;
  client?: TranscriptionClientLike;
}

export async function transcribeVideoFile(
  videoPath: string,
  opts: TranscribeOptions,
): Promise<TranscriptLine[]> {
  const client: TranscriptionClientLike =
    opts.client ?? (new OpenAI({ apiKey: opts.apiKey }) as unknown as TranscriptionClientLike);

  // 영상을 통째로 메모리에 올리지 않고 스트림으로 넘긴다.
  const file = await toFile(createReadStream(videoPath), "reel.mp4", { type: "video/mp4" });
  const response = await client.audio.transcriptions.create({
    file,
    model: opts.model ?? DEFAULT_TRANSCRIPTION_MODEL,
    response_format: "verbose_json",
  });
  return parseWhisperResponse(response);
}
