import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import {
  cachedVideoFileName,
  downloadVideoToCache,
  readCachedVideoStat,
  resolveCachedVideoPath,
  videoCacheDir,
} from "@/lib/media/videoCache";

async function tempDataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "reel-video-"));
}

test("캐시 디렉토리는 데이터 디렉토리 아래 videos다", () => {
  expect(videoCacheDir("/data")).toBe(join("/data", "videos"));
});

test("릴스 id로 mp4 파일명을 만든다", () => {
  expect(cachedVideoFileName("17912345678901234")).toBe("17912345678901234.mp4");
});

test("파일명으로 쓸 수 없는 id는 거부한다", () => {
  // 경로 조작 방어의 1차선. 여기서 막으면 아래 resolve는 애초에 위험한 입력을 못 본다.
  for (const evil of ["../../etc/passwd", "a/b", "a\\b", "..", "", "  ", "a.mp4", "a;rm -rf"]) {
    expect(() => cachedVideoFileName(evil)).toThrow();
  }
});

test("캐시 경로는 언제나 videos 디렉토리 안에 놓인다", () => {
  const path = resolveCachedVideoPath("/data", "r1");
  expect(path.startsWith(join("/data", "videos") + sep)).toBe(true);
  expect(path.endsWith("r1.mp4")).toBe(true);
});

test("경로 조작을 시도하는 id는 경로 해석 단계에서도 던진다", () => {
  expect(() => resolveCachedVideoPath("/data", "../../../etc/passwd")).toThrow();
});

test("캐시가 없으면 stat은 null이다", async () => {
  const dataDir = await tempDataDir();
  expect(await readCachedVideoStat(dataDir, "r1")).toBeNull();
});

test("캐시가 있으면 크기를 알려준다", async () => {
  const dataDir = await tempDataDir();
  await mkdir(videoCacheDir(dataDir), { recursive: true });
  await writeFile(resolveCachedVideoPath(dataDir, "r1"), "0123456789");

  const stat = await readCachedVideoStat(dataDir, "r1");
  expect(stat?.size).toBe(10);
});

test("mp4를 내려받아 캐시에 저장하고 파일명을 돌려준다", async () => {
  const dataDir = await tempDataDir();
  const fetchImpl = async () =>
    new Response(new Uint8Array([1, 2, 3, 4]), {
      status: 200,
      headers: { "content-type": "video/mp4", "content-length": "4" },
    });

  const result = await downloadVideoToCache(dataDir, "r1", "https://cdn/x.mp4", fetchImpl);

  expect(result.fileName).toBe("r1.mp4");
  expect(result.bytes).toBe(4);
  const saved = await readFile(resolveCachedVideoPath(dataDir, "r1"));
  expect([...saved]).toEqual([1, 2, 3, 4]);
});

test("https가 아닌 주소는 내려받지 않는다", async () => {
  const dataDir = await tempDataDir();
  await expect(
    downloadVideoToCache(dataDir, "r1", "file:///etc/passwd", async () => new Response("")),
  ).rejects.toThrow(/https/);
});

test("CDN이 오류를 주면 상태 코드를 담아 실패시킨다", async () => {
  const dataDir = await tempDataDir();
  const fetchImpl = async () => new Response("gone", { status: 403 });

  await expect(
    downloadVideoToCache(dataDir, "r1", "https://cdn/x.mp4", fetchImpl),
  ).rejects.toThrow(/403/);
  // 실패한 다운로드가 반쪽짜리 캐시를 남기면 안 된다.
  expect(await readCachedVideoStat(dataDir, "r1")).toBeNull();
});

test("선언된 크기가 상한을 넘으면 본문을 읽기 전에 거부한다", async () => {
  const dataDir = await tempDataDir();
  let bodyRead = false;
  const fetchImpl = async () => {
    const res = new Response("x", {
      status: 200,
      headers: { "content-length": String(1024 * 1024 * 1024) },
    });
    Object.defineProperty(res, "body", {
      get() {
        bodyRead = true;
        return null;
      },
    });
    return res;
  };

  await expect(
    downloadVideoToCache(dataDir, "r1", "https://cdn/x.mp4", fetchImpl),
  ).rejects.toThrow(/큽니다/);
  expect(bodyRead).toBe(false);
});

test("빈 응답 본문은 캐시로 인정하지 않는다", async () => {
  const dataDir = await tempDataDir();
  const fetchImpl = async () => new Response(null, { status: 200 });

  await expect(
    downloadVideoToCache(dataDir, "r1", "https://cdn/x.mp4", fetchImpl),
  ).rejects.toThrow(/본문/);
});
