import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Graph API의 `media_url`은 서명·만료되는 CDN 주소라 하루면 죽는다. 상세 페이지에서
 * 영상을 다시 볼 수 있으려면 mp4를 워크스페이스에 한 번 받아 두는 수밖에 없다.
 */
const VIDEO_CACHE_DIRNAME = "videos";

/** 릴스 한 편의 캐시 상한(200MB). 90초짜리 세로 영상은 한참 밑이다. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export function videoCacheDir(dataDir: string): string {
  return join(dataDir, VIDEO_CACHE_DIRNAME);
}

/**
 * 릴스 id를 파일명으로 좁힌다.
 *
 * 경로 조작 방어의 1차선이다. 인스타그램 미디어 id는 숫자열이지만, 저장소에 무엇이
 * 들어있든 파일 시스템에 닿기 전에 허용 문자만 통과시킨다. 점(.)까지 막아
 * `..`이 이름 자체로 성립할 수 없게 한다.
 */
export function cachedVideoFileName(reelId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(reelId)) {
    throw new Error("릴스 id에 파일명으로 쓸 수 없는 문자가 있습니다");
  }
  return `${reelId}.mp4`;
}

/**
 * 캐시된 mp4의 절대 경로.
 *
 * 사용자 입력 경로를 받지 않는다 — 릴스 id에서 파일명을 새로 만든다. 저장된
 * `reel.videoFile`을 그대로 열면 저장소가 오염됐을 때 임의 파일 읽기가 되므로,
 * 그 필드는 "캐시가 있다"는 표시로만 쓴다.
 */
export function resolveCachedVideoPath(dataDir: string, reelId: string): string {
  const dir = resolve(videoCacheDir(dataDir));
  const path = resolve(dir, cachedVideoFileName(reelId));
  // 위 정규식이 이미 막지만, 방어선을 하나로 두지 않는다.
  if (!path.startsWith(dir + sep)) {
    throw new Error("영상 캐시 경로가 캐시 디렉토리를 벗어났습니다");
  }
  return path;
}

export interface CachedVideoStat {
  path: string;
  size: number;
}

/** 캐시된 mp4의 경로와 크기. 없으면 null. */
export async function readCachedVideoStat(
  dataDir: string,
  reelId: string,
): Promise<CachedVideoStat | null> {
  const path = resolveCachedVideoPath(dataDir, reelId);
  try {
    const info = await stat(path);
    return info.isFile() ? { path, size: info.size } : null;
  } catch {
    return null;
  }
}

export interface VideoDownloadResult {
  fileName: string;
  bytes: number;
}

type FetchLike = (url: string) => Promise<Response>;

function assertWithinLimit(declared: string | null): void {
  if (declared === null) return;
  const bytes = Number(declared);
  if (Number.isFinite(bytes) && bytes > MAX_VIDEO_BYTES) {
    throw new Error(
      `영상이 너무 큽니다 (${Math.round(bytes / 1024 / 1024)}MB, 상한 ${MAX_VIDEO_BYTES / 1024 / 1024}MB)`,
    );
  }
}

/**
 * mp4를 캐시 디렉토리로 내려받는다.
 *
 * 받는 중에는 `.part`에 쓰고 다 받은 뒤에만 제자리로 옮긴다. 중간에 끊긴 파일이
 * 캐시 자리에 남으면 상세 페이지가 재생되지 않는 영상을 "받아 뒀다"고 표시한다.
 */
export async function downloadVideoToCache(
  dataDir: string,
  reelId: string,
  mediaUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<VideoDownloadResult> {
  if (!mediaUrl.startsWith("https://")) {
    throw new Error("영상 주소가 https가 아닙니다");
  }
  const path = resolveCachedVideoPath(dataDir, reelId);
  const partPath = `${path}.part`;

  const res = await fetchImpl(mediaUrl);
  if (!res.ok) {
    throw new Error(`영상을 내려받지 못했습니다 (HTTP ${res.status}). 주소가 만료됐을 수 있습니다.`);
  }
  assertWithinLimit(res.headers.get("content-length"));
  if (!res.body) throw new Error("영상 응답 본문이 비어 있습니다");

  await mkdir(videoCacheDir(dataDir), { recursive: true });
  let bytes = 0;
  try {
    const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
    source.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      // Content-Length가 없거나 거짓말을 해도 디스크를 채우게 두지 않는다.
      if (bytes > MAX_VIDEO_BYTES) source.destroy(new Error("영상이 너무 큽니다"));
    });
    await pipeline(source, createWriteStream(partPath));
  } catch (err) {
    await rm(partPath, { force: true });
    throw err;
  }

  if (bytes === 0) {
    await rm(partPath, { force: true });
    throw new Error("영상 응답 본문이 비어 있습니다");
  }
  await rename(partPath, path);
  return { fileName: cachedVideoFileName(reelId), bytes };
}
