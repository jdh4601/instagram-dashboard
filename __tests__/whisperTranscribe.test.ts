import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseWhisperResponse,
  transcribeAudioFile,
  transcribeVideoFile,
  DEFAULT_TRANSCRIPTION_MODEL,
} from "@/lib/media/transcribe";

test("Whisper 세그먼트를 자막 줄로 옮긴다", () => {
  const lines = parseWhisperResponse({
    segments: [
      { start: 0, end: 2.5, text: " 안녕하세요 " },
      { start: 2.5, end: 5.25, text: "오늘은 이걸 해볼게요" },
    ],
  });

  expect(lines).toEqual([
    { startSec: 0, endSec: 2.5, text: "안녕하세요" },
    { startSec: 2.5, endSec: 5.3, text: "오늘은 이걸 해볼게요" },
  ]);
});

test("빈 세그먼트는 자막 줄로 만들지 않는다", () => {
  const lines = parseWhisperResponse({
    segments: [
      { start: 0, end: 1, text: "   " },
      { start: 1, end: 2, text: "말" },
    ],
  });

  expect(lines).toHaveLength(1);
  expect(lines[0].text).toBe("말");
});

test("세그먼트가 없는 응답은 조용히 빈 자막이 되지 않고 실패한다", () => {
  // 모델을 바꿨을 때 verbose_json을 지원하지 않으면 여기서 드러나야 한다.
  expect(() => parseWhisperResponse({ text: "전체 텍스트만 있음" })).toThrow(/세그먼트/);
});

test("한 마디도 인식하지 못하면 실패로 알린다", () => {
  expect(() => parseWhisperResponse({ segments: [] })).toThrow(/인식/);
});

test("캐시된 mp4를 전사 API에 보내 자막을 만든다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "whisper-"));
  await mkdir(dir, { recursive: true });
  const path = join(dir, "r1.mp4");
  await writeFile(path, "fake mp4 bytes");

  const create = vi.fn(async (_args: unknown) => ({
    segments: [{ start: 0, end: 1.5, text: "훅 문장" }],
  }));

  const lines = await transcribeVideoFile(path, {
    client: { audio: { transcriptions: { create } } },
    model: DEFAULT_TRANSCRIPTION_MODEL,
  });

  expect(lines).toEqual([{ startSec: 0, endSec: 1.5, text: "훅 문장" }]);
  const args = create.mock.calls[0][0] as { model: string; response_format: string };
  expect(args.model).toBe(DEFAULT_TRANSCRIPTION_MODEL);
  // 타임스탬프 없이는 훅·비트 분석의 시점을 잡을 수 없다.
  expect(args.response_format).toBe("verbose_json");
});

test("무음 구간에서 나온 환청 세그먼트는 자막에 넣지 않는다", () => {
  // 배경음악만 흐르는 구간에서 whisper가 만들어 내는 문장은 no_speech_prob이 높고
  // avg_logprob이 낮다. 이걸 그대로 두면 훅 구간 대사가 통째로 가짜가 된다.
  const lines = parseWhisperResponse({
    segments: [
      { start: 0, end: 2, text: "시청해주셔서 감사합니다", no_speech_prob: 0.94, avg_logprob: -1.4 },
      { start: 2, end: 4, text: "진짜 대사", no_speech_prob: 0.02, avg_logprob: -0.3 },
    ],
  });

  expect(lines).toEqual([{ startSec: 2, endSec: 4, text: "진짜 대사" }]);
});

test("확신도가 낮아도 말이 있는 구간이면 남긴다", () => {
  const lines = parseWhisperResponse({
    segments: [{ start: 0, end: 2, text: "잘 안 들리는 대사", no_speech_prob: 0.1, avg_logprob: -1.6 }],
  });

  expect(lines).toHaveLength(1);
});

test("전사는 온도를 0으로 고정해 같은 영상에서 같은 자막을 만든다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "whisper-"));
  const path = join(dir, "r2.mp3");
  await writeFile(path, "fake mp3 bytes");
  const create = vi.fn(async (_args: unknown) => ({
    segments: [{ start: 0, end: 1, text: "한 마디" }],
  }));

  await transcribeAudioFile(path, { client: { audio: { transcriptions: { create } } } });

  const args = create.mock.calls[0][0] as { temperature: number };
  expect(args.temperature).toBe(0);
});
