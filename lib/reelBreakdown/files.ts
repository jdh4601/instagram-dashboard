import { rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const ROOT_NAME = "reel-breakdowns";
const SAFE_KEY = /^[A-Za-z0-9_-]+$/;
const SAFE_ASSET = /^(?:frames\/\d{4}\.jpg|clips\/\d{2}\.mp4)$/;

export function reelBreakdownRoot(dataDir: string): string {
  return resolve(dataDir, ROOT_NAME);
}

export function reelBreakdownDir(dataDir: string, assetKey: string): string {
  if (!SAFE_KEY.test(assetKey)) throw new Error("릴스 해체 asset 키가 올바르지 않습니다");
  const root = reelBreakdownRoot(dataDir);
  const dir = resolve(root, assetKey);
  if (!dir.startsWith(root + sep)) throw new Error("릴스 해체 경로가 저장소를 벗어났습니다");
  return dir;
}

/** 요청은 frames/0001.jpg 또는 clips/01.mp4 두 형태만 열 수 있다. */
export function reelBreakdownAssetPath(
  dataDir: string,
  assetKey: string,
  relativeAsset: string,
): string {
  if (!SAFE_ASSET.test(relativeAsset)) throw new Error("허용되지 않은 릴스 해체 파일입니다");
  return join(reelBreakdownDir(dataDir, assetKey), relativeAsset);
}

export async function removeReelBreakdownAssets(dataDir: string, assetKey: string): Promise<void> {
  await rm(reelBreakdownDir(dataDir, assetKey), { recursive: true, force: true });
}
