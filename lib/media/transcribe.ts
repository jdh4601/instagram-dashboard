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
  /** 이 구간이 무음일 확률. 배경음악만 있는 릴스 구간에서 1에 가까워진다. */
  no_speech_prob: z.number().optional(),
  /** 토큰 평균 로그확률. 모델이 스스로 확신하지 못한 구간일수록 낮다. */
  avg_logprob: z.number().optional(),
});

const WhisperResponseSchema = z.object({
  segments: z.array(WhisperSegmentSchema).optional(),
});

/** 초 단위를 0.1초로 반올림. SRT 업로드 경로와 정밀도를 맞춘다. */
const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * 환청(hallucination) 구간을 버리는 기준.
 *
 * 릴스는 말이 없고 음악만 흐르는 구간이 흔한데, whisper는 그런 구간에도 "시청해주셔서
 * 감사합니다" 같은 학습 데이터 상투구를 채워 넣는다. 무음 확률이 높으면서 확신도까지
 * 낮을 때만 버린다 — 둘 중 하나만으로는 웅얼거리는 진짜 대사까지 날아간다.
 */
const HALLUCINATION_NO_SPEECH_PROB = 0.8;
const HALLUCINATION_AVG_LOGPROB = -1;

function isHallucinated(segment: z.infer<typeof WhisperSegmentSchema>): boolean {
  return (
    (segment.no_speech_prob ?? 0) >= HALLUCINATION_NO_SPEECH_PROB &&
    (segment.avg_logprob ?? 0) <= HALLUCINATION_AVG_LOGPROB
  );
}

export function parseWhisperResponse(raw: unknown): TranscriptLine[] {
  const parsed = WhisperResponseSchema.parse(raw);
  if (!parsed.segments) {
    throw new Error(
      "전사 응답에 세그먼트가 없습니다. 타임스탬프를 주는 모델(whisper-1)인지 확인해 주세요.",
    );
  }
  const lines = parsed.segments
    .filter((segment) => !isHallucinated(segment))
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
  return transcribeMediaFile(videoPath, "reel.mp4", "video/mp4", opts);
}

/** 해체 파이프라인은 mp4에서 작은 mp3를 먼저 뽑아 전사 업로드 상한을 피한다. */
export async function transcribeAudioFile(
  audioPath: string,
  opts: TranscribeOptions,
): Promise<TranscriptLine[]> {
  return transcribeMediaFile(audioPath, "reel.mp3", "audio/mpeg", opts);
}

async function transcribeMediaFile(
  mediaPath: string,
  fileName: string,
  mediaType: string,
  opts: TranscribeOptions,
): Promise<TranscriptLine[]> {
  const client: TranscriptionClientLike =
    opts.client ?? (new OpenAI({ apiKey: opts.apiKey }) as unknown as TranscriptionClientLike);

  // 미디어를 통째로 메모리에 올리지 않고 스트림으로 넘긴다.
  const file = await toFile(createReadStream(mediaPath), fileName, { type: mediaType });
  const response = await client.audio.transcriptions.create({
    file,
    model: opts.model ?? DEFAULT_TRANSCRIPTION_MODEL,
    response_format: "verbose_json",
    // 기본값(0.2 이상에서 시작하는 fallback)은 같은 영상을 두 번 돌릴 때 자막이
    // 달라지고, 안 들리는 구간을 그럴듯한 문장으로 메우는 쪽으로 기운다.
    temperature: 0,
  });
  return parseWhisperResponse(response);
}
