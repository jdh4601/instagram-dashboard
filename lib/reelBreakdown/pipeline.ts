import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";
import type { Hook, HookBreakdown } from "@/lib/schemas/hook";
import { HookBreakdownSchema } from "@/lib/schemas/hook";
import type { VisionImage, VisionModel } from "@/lib/llm/types";
import type { TranscriptionCredentials } from "@/lib/llm/transcription";
import { transcribeAudioFile } from "@/lib/media/transcribe";
import { generateBreakdownAnalysis } from "@/lib/reelBreakdown/analysis";
import { reelBreakdownDir, reelBreakdownRoot } from "@/lib/reelBreakdown/files";

const FRAME_INTERVAL_SECONDS = 2;
const MAX_VISION_FRAMES = 12;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export interface BreakdownProgress {
  phase: "download" | "inspect" | "transcribe" | "frames" | "analyze" | "clips" | "save";
  percent: number;
  message: string;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

type CommandRunner = (
  command: string,
  args: string[],
  options?: { timeout?: number; maxBuffer?: number },
) => Promise<CommandResult>;

const runCommand: CommandRunner = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        timeout: options.timeout ?? 120_000,
        maxBuffer: options.maxBuffer ?? 2_000_000,
      },
      (error, stdout, stderr) => {
        if (!error) return resolve({ stdout: String(stdout), stderr: String(stderr) });
        if (/ENOENT/.test(error.message)) {
          return reject(new Error(`${command}가 설치되어 있지 않습니다`));
        }
        const detail = String(stderr || stdout).trim().split("\n").at(-1);
        reject(new Error(detail || error.message));
      },
    );
  });

/** 쿼리스트링을 버리고 yt-dlp에 넘길 수 있는 공개 Instagram permalink로 좁힌다. */
export function normalizeInstagramReelUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("원본 릴스 링크가 올바르지 않습니다");
  }
  if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname)) {
    throw new Error("Instagram https 링크만 해체할 수 있습니다");
  }
  const match = /^\/(reel|reels|p)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
  if (!match) throw new Error("Instagram 릴스 또는 영상 게시물 링크가 아닙니다");
  return `https://www.instagram.com/${match[1]}/${match[2]}/`;
}

/**
 * Instagram embed HTML에는 플레이어가 바로 쓰는 서명된 video_url이 들어 있다.
 * yt-dlp가 비로그인 응답을 비었다고 판단하는 공개 릴스도 embed 플레이어는 재생되므로,
 * 외부 스킬의 다운로드 단계가 막힐 때 이 URL을 같은 원본 mp4로 내려받는다.
 */
export function parseInstagramEmbedVideoUrl(html: string): string {
  const marker = '\\"video_url\\":\\"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) throw new Error("embed 응답에서 영상 주소를 찾지 못했습니다");
  const start = markerIndex + marker.length;
  const end = html.indexOf('\\"', start);
  if (end === -1) throw new Error("embed 영상 주소가 끝나지 않았습니다");
  const raw = html
    .slice(start, end)
    .replace(/\\+\//g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("embed 영상 주소가 올바르지 않습니다");
  }
  const allowedHost =
    url.hostname === "cdninstagram.com" ||
    url.hostname.endsWith(".cdninstagram.com") ||
    url.hostname === "fbcdn.net" ||
    url.hostname.endsWith(".fbcdn.net");
  if (url.protocol !== "https:" || !allowedHost) {
    throw new Error("embed 영상 주소가 Instagram CDN이 아닙니다");
  }
  return url.toString();
}

async function downloadFromEmbed(reelUrl: string, output: string): Promise<void> {
  const embedUrl = `${reelUrl.replace(/\/$/, "")}/embed/`;
  const embedResponse = await fetch(embedUrl, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!embedResponse.ok) {
    throw new Error(`Instagram embed가 응답하지 않았습니다 (${embedResponse.status})`);
  }
  const videoUrl = parseInstagramEmbedVideoUrl(await embedResponse.text());
  const videoResponse = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) });
  if (!videoResponse.ok || !videoResponse.body) {
    throw new Error(`Instagram CDN에서 영상을 받지 못했습니다 (${videoResponse.status})`);
  }
  const declaredBytes = Number(videoResponse.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_VIDEO_BYTES) {
    throw new Error("영상이 200MB를 넘어 해체할 수 없습니다");
  }

  const part = `${output}.part`;
  let bytes = 0;
  try {
    const source = Readable.fromWeb(videoResponse.body as Parameters<typeof Readable.fromWeb>[0]);
    source.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_VIDEO_BYTES) source.destroy(new Error("영상이 200MB를 넘었습니다"));
    });
    await streamPipeline(source, createWriteStream(part));
    if (bytes === 0) throw new Error("Instagram CDN 영상이 비어 있습니다");
    await rename(part, output);
  } catch (error) {
    await rm(part, { force: true });
    throw error;
  }
}

function parseDuration(stdout: string): number {
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0 || duration > 900) {
    throw new Error("영상 길이를 읽지 못했습니다");
  }
  return Math.round(duration * 1000) / 1000;
}

export function parseSceneCuts(stderr: string): number[] {
  return [...stderr.matchAll(/pts_time:([0-9]+(?:\.[0-9]+)?)/g)].map((match) =>
    Math.round(Number(match[1]) * 10) / 10,
  );
}

async function nearestFrame(framesDir: string, seconds: number): Promise<string> {
  const ideal = Math.round(seconds / FRAME_INTERVAL_SECONDS) + 1;
  for (const index of [ideal, ideal - 1, ideal + 1, 1]) {
    const name = `${Math.max(1, index)}`.padStart(4, "0") + ".jpg";
    try {
      if ((await stat(join(framesDir, name))).isFile()) return name;
    } catch {
      // 다음 후보를 본다.
    }
  }
  throw new Error("포스터로 쓸 프레임이 없습니다");
}

function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const indexes = Array.from({ length: max }, (_, index) =>
    Math.round((index * (items.length - 1)) / (max - 1)),
  );
  return indexes.map((index) => items[index]);
}

async function visionFrames(framesDir: string): Promise<VisionImage[]> {
  const names = (await readdir(framesDir)).filter((name) => /^\d{4}\.jpg$/.test(name)).sort();
  if (names.length === 0) throw new Error("분석할 프레임이 없습니다");
  return Promise.all(
    sampleEvenly(names, MAX_VISION_FRAMES).map(async (name) => {
      const index = Number.parseInt(basename(name, ".jpg"), 10);
      return {
        label: `[프레임 ${(index - 1) * FRAME_INTERVAL_SECONDS}초]`,
        mediaType: "image/jpeg" as const,
        base64: (await readFile(join(framesDir, name))).toString("base64"),
      };
    }),
  );
}

function clipPercent(index: number, total: number): number {
  return 82 + Math.round(((index + 1) / total) * 14);
}

export async function runReelBreakdown(args: {
  hook: Hook;
  dataDir: string;
  transcription: TranscriptionCredentials;
  visionModel: VisionModel;
  onProgress?: (progress: BreakdownProgress) => void;
  command?: CommandRunner;
}): Promise<HookBreakdown> {
  if (!args.hook.sourceUrl) throw new Error("원본 링크가 있는 훅만 해체할 수 있습니다");
  const reelUrl = normalizeInstagramReelUrl(args.hook.sourceUrl);
  const command = args.command ?? runCommand;
  const notify = (progress: BreakdownProgress) => args.onProgress?.(progress);
  const assetKey = randomUUID();
  const root = reelBreakdownRoot(args.dataDir);
  const dir = reelBreakdownDir(args.dataDir, assetKey);
  const framesDir = join(dir, "frames");
  const clipsDir = join(dir, "clips");
  const source = join(dir, "source.mp4");
  const audio = join(dir, "source.mp3");
  await mkdir(root, { recursive: true, mode: 0o700 });
  await mkdir(framesDir, { recursive: true, mode: 0o700 });
  await mkdir(clipsDir, { recursive: true, mode: 0o700 });

  try {
    notify({ phase: "download", percent: 5, message: "원본 릴스를 받는 중" });
    try {
      await command(
        "yt-dlp",
        [
          "--no-playlist",
          "--no-warnings",
          "--merge-output-format",
          "mp4",
          "-f",
          "bv*+ba/b",
          "-o",
          source,
          "--",
          reelUrl,
        ],
        { timeout: 180_000, maxBuffer: 2_000_000 },
      );
    } catch (ytDlpError) {
      notify({ phase: "download", percent: 12, message: "공개 embed 영상으로 다시 받는 중" });
      try {
        await downloadFromEmbed(reelUrl, source);
      } catch (embedError) {
        const ytDlpMessage = ytDlpError instanceof Error ? ytDlpError.message : "yt-dlp 실패";
        const embedMessage = embedError instanceof Error ? embedError.message : "embed 다운로드 실패";
        throw new Error(`원본 릴스를 받지 못했습니다. ${ytDlpMessage} / ${embedMessage}`);
      }
    }
    const sourceStat = await stat(source);
    if (!sourceStat.isFile() || sourceStat.size === 0) throw new Error("영상을 받지 못했습니다");
    if (sourceStat.size > MAX_VIDEO_BYTES) throw new Error("영상이 200MB를 넘어 해체할 수 없습니다");

    notify({ phase: "inspect", percent: 20, message: "영상 길이와 컷 전환을 읽는 중" });
    const durationResult = await command("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      source,
    ]);
    const durationSec = parseDuration(durationResult.stdout);
    const sceneResult = await command(
      "ffmpeg",
      [
        "-hide_banner",
        "-i",
        source,
        "-filter:v",
        "select='gt(scene,0.32)',showinfo",
        "-f",
        "null",
        "-",
      ],
      { timeout: 120_000, maxBuffer: 20_000_000 },
    );
    const cuts = parseSceneCuts(sceneResult.stderr);

    notify({ phase: "transcribe", percent: 32, message: "음성을 추출하고 자막을 만드는 중" });
    await command("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-vn",
      // 릴스는 음악이 대사만큼 크게 깔린다. 저역(비트·베이스)을 자르고 라우드니스를
      // 고르게 맞춰야 whisper가 작게 말한 구간을 통째로 지어내지 않는다.
      "-af",
      "highpass=f=90,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=16000",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "96k",
      audio,
    ]);
    const transcript = await transcribeAudioFile(audio, args.transcription);
    await rm(audio, { force: true });

    notify({ phase: "frames", percent: 52, message: "2초 간격으로 장면 프레임을 뽑는 중" });
    await command("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-vf",
      "fps=1/2,scale=720:-2",
      "-q:v",
      "3",
      join(framesDir, "%04d.jpg"),
    ]);
    const images = await visionFrames(framesDir);

    notify({ phase: "analyze", percent: 68, message: "대사·장면·훅 유형을 구조로 나누는 중" });
    const analysis = await generateBreakdownAnalysis({
      hook: args.hook,
      transcript,
      durationSec,
      cuts,
      images,
      model: args.visionModel,
    });

    const beats = [];
    for (let index = 0; index < analysis.beats.length; index += 1) {
      const beat = analysis.beats[index];
      const clipFile = `${index + 1}`.padStart(2, "0") + ".mp4";
      notify({
        phase: "clips",
        percent: clipPercent(index, analysis.beats.length),
        message: `구간 영상 ${index + 1}/${analysis.beats.length} 만드는 중`,
      });
      await command("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        String(beat.start),
        "-to",
        String(beat.end),
        "-i",
        source,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-movflags",
        "+faststart",
        join(clipsDir, clipFile),
      ]);
      beats.push({
        ...beat,
        clipFile,
        posterFile: await nearestFrame(framesDir, beat.start),
      });
    }

    notify({ phase: "save", percent: 98, message: "해체 결과를 저장하는 중" });
    const result = HookBreakdownSchema.parse({
      reelUrl,
      assetKey,
      durationSec,
      cuts,
      hookType: analysis.hookType,
      storyFormatId: analysis.storyFormatId,
      beats,
      generatedAt: new Date().toISOString(),
    });
    await writeFile(join(dir, "data.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
    // 원본은 구간 클립을 모두 만든 뒤 지운다. 외부 스킬과 같은 개인정보·용량 정책이다.
    await rm(source, { force: true });
    return result;
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

/** 외부 스킬의 프레임 선택 규칙을 단위 테스트에서 확인할 수 있게 노출한다. */
