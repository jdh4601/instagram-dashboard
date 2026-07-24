import { execFile } from "node:child_process";

/**
 * Graph API에는 영상 길이 필드가 없다(`duration`·`video_duration` 모두 400).
 * 대신 릴스의 `media_url`이 재생 가능한 mp4를 주므로 ffprobe로 컨테이너 메타데이터만 읽는다.
 */
const FFPROBE_ARGS = ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0"];

/** ffprobe 한 번의 시간 상한. CDN이 느려도 동기화 전체를 붙잡지 못하게 한다. */
export const FFPROBE_TIMEOUT_MS = 20_000;

/** 릴스 길이 상한(15분). 이보다 크면 길이가 아니라 잘못 읽은 값으로 본다. */
export const MAX_PROBE_DURATION_SEC = 900;

/** ffprobe 실행부. 테스트에서 갈아 끼울 수 있게 분리한다. */
export type FfprobeRunner = (mediaUrl: string) => Promise<string>;

export function parseFfprobeDuration(stdout: string): number | null {
  const value = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(value) || value <= 0 || value > MAX_PROBE_DURATION_SEC) return null;
  return Math.round(value * 10) / 10;
}

function runFfprobe(mediaUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      [...FFPROBE_ARGS, mediaUrl],
      { timeout: FFPROBE_TIMEOUT_MS, maxBuffer: 1_000_000 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

/**
 * 영상 길이(초). 실패하면 던지지 않고 null을 돌려준다 — ffprobe가 없는 환경이나
 * 만료된 CDN URL 때문에 동기화 전체가 멈추면 안 된다. 호출부는 null을 "길이 미상"으로
 * 두고 INS-4의 수동 입력을 폴백으로 남긴다.
 */
export async function probeDurationSec(
  mediaUrl: string,
  run: FfprobeRunner = runFfprobe,
): Promise<number | null> {
  // ffprobe에 넘기는 인자는 원격 미디어 URL로 한정한다(로컬 경로·프로토콜 주입 차단).
  if (!/^https?:\/\//.test(mediaUrl)) return null;
  try {
    return parseFfprobeDuration(await run(mediaUrl));
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // execFile 오류 메시지에는 실행 명령 전체가 들어간다. media_url은 서명 토큰을
    // 포함한 만료성 URL이라 로그에 그대로 남기지 않는다.
    console.warn(`[duration] ffprobe 실패 — 길이를 비워 둡니다: ${raw.split(mediaUrl).join("<media_url>")}`);
    return null;
  }
}
