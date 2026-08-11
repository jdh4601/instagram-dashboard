import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  MAX_VIDEO_BYTES,
  cachedVideoFileName,
  resolveCachedVideoPath,
  videoCacheDir,
  type VideoDownloadResult,
} from "@/lib/media/videoCache";

/**
 * Graph가 mp4 주소를 안 줄 때의 마지막 수단.
 *
 * 살아 있는 릴스인데도 `media_url`이 빠진 응답이 온다(저작권 있는 음원이 섞이면
 * Meta가 이 필드를 제외한다). 그런 게시물은 재동기화해도 영원히 비어 있어서,
 * 공개 permalink에서 직접 받는 경로를 하나 더 둔다.
 *
 * 사용자 자신의 게시물을 자기 워크스페이스로 받아 자막을 뽑는 용도다. 외부
 * 바이너리에 기대므로 실패를 정상 흐름으로 취급한다 — 호출부가 사유를 그대로 보여준다.
 */

/** yt-dlp 한 번의 시간 상한. 라우트 요청이 무한정 매달리지 않게 한다. */
const YTDLP_TIMEOUT_MS = 120_000;

/**
 * 허용하는 permalink 형태.
 *
 * 인자를 배열로 넘겨도(셸 없음) `-`로 시작하는 값은 yt-dlp가 플래그로 읽으므로,
 * 호스트와 경로 모양을 함께 고정해 임의 문자열이 명령줄에 닿지 않게 한다.
 */
const INSTAGRAM_PERMALINK = /^https:\/\/www\.instagram\.com\/(?:reel|reels|p)\/[A-Za-z0-9_-]+\/?$/;

export function isInstagramPermalink(permalink: string): boolean {
  return INSTAGRAM_PERMALINK.test(permalink);
}

/** yt-dlp 실행부. 받은 파일은 outDir 안에 남긴다. 테스트에서 갈아 끼운다. */
export type YtdlpRunner = (permalink: string, outDir: string) => Promise<void>;

function runYtdlp(permalink: string, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      [
        "--no-warnings",
        "--no-playlist",
        // 오디오·영상이 나뉜 포맷을 받아 합치면 ffmpeg까지 필요해진다. 단일 mp4로 좁힌다.
        "-f",
        "mp4",
        "-o",
        join(outDir, "%(id)s.%(ext)s"),
        // 이 뒤는 값이다. '--'가 없으면 주소가 플래그로 해석될 여지가 남는다.
        "--",
        permalink,
      ],
      { timeout: YTDLP_TIMEOUT_MS, maxBuffer: 1_000_000 },
      (err, _stdout, stderr) => {
        if (!err) return resolve();
        // execFile의 기본 메시지는 명령줄 전체라 길다. yt-dlp가 남긴 사유를 우선 쓴다.
        const reason = String(stderr).trim().split("\n").at(-1);
        if (/ENOENT/.test(err.message)) {
          return reject(new Error("yt-dlp가 설치되어 있지 않습니다 (brew install yt-dlp)"));
        }
        reject(new Error(reason || err.message));
      },
    );
  });
}

/**
 * permalink에서 mp4를 받아 캐시에 놓는다.
 *
 * yt-dlp가 어떤 이름으로 저장할지 확신할 수 없어 캐시 디렉토리 안의 임시 폴더에 받고,
 * 다 받은 뒤에만 릴스 id 이름으로 옮긴다. 같은 파일 시스템이라 rename이 원자적이고,
 * 중간에 끊긴 파일이 캐시 자리를 차지해 "받아 뒀다"고 오인되는 일도 없다.
 */
export async function downloadViaYtdlp(
  dataDir: string,
  reelId: string,
  permalink: string,
  run: YtdlpRunner = runYtdlp,
  maxBytes: number = MAX_VIDEO_BYTES,
): Promise<VideoDownloadResult> {
  // 파일명으로 쓸 수 없는 id는 여기서 던진다 — 외부 프로세스를 띄우기 전에 막는다.
  const finalPath = resolveCachedVideoPath(dataDir, reelId);
  if (!isInstagramPermalink(permalink)) {
    throw new Error("인스타그램 게시물 주소가 아니라서 영상을 받을 수 없습니다");
  }

  const cacheDir = videoCacheDir(dataDir);
  await mkdir(cacheDir, { recursive: true });
  const workDir = await mkdtemp(join(cacheDir, ".ytdlp-"));

  try {
    await run(permalink, workDir);

    const produced = await readdir(workDir);
    if (produced.length === 0) {
      throw new Error("yt-dlp가 영상을 받지 못했습니다");
    }
    const downloaded = join(workDir, produced[0]);
    const { size } = await stat(downloaded);
    if (size > maxBytes) {
      throw new Error(
        `영상이 너무 큽니다 (${Math.round(size / 1024 / 1024)}MB, 상한 ${Math.round(maxBytes / 1024 / 1024)}MB)`,
      );
    }

    await rename(downloaded, finalPath);
    return { fileName: cachedVideoFileName(reelId), bytes: size };
  } finally {
    // 성공·실패 어느 쪽이든 작업 폴더는 남기지 않는다.
    await rm(workDir, { recursive: true, force: true });
  }
}
