import { mkdtemp, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  downloadViaYtdlp,
  isInstagramPermalink,
  type YtdlpRunner,
} from "@/lib/media/ytdlpFallback";
import { videoCacheDir } from "@/lib/media/videoCache";

async function tempDataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ytdlp-fallback-"));
}

/** yt-dlp가 outDir에 파일 하나를 남기고 끝나는 성공 실행을 흉내낸다. */
function fakeRunner(bytes: string, name = "video.mp4"): YtdlpRunner {
  return async (_permalink, outDir) => {
    await writeFile(join(outDir, name), bytes);
  };
}

test("인스타그램 릴스·게시물 주소만 통과시킨다", () => {
  expect(isInstagramPermalink("https://www.instagram.com/reel/Db458XCB9RH/")).toBe(true);
  expect(isInstagramPermalink("https://www.instagram.com/p/Db458XCB9RH")).toBe(true);
  expect(isInstagramPermalink("https://www.instagram.com/reels/Db458XCB9RH/")).toBe(true);
});

test("yt-dlp에 넘길 수 없는 주소는 막는다", () => {
  // 인자 배열로 넘겨도 '-'로 시작하는 값은 플래그로 읽힌다. 외부 호스트와 함께 차단한다.
  for (const evil of [
    "--exec=rm -rf /",
    "-o/etc/passwd",
    "https://evil.example/reel/x/",
    "http://www.instagram.com/reel/x/",
    "https://www.instagram.com.evil.com/reel/x/",
    "https://www.instagram.com/reel/x/../../y",
    "file:///etc/passwd",
    "",
  ]) {
    expect(isInstagramPermalink(evil)).toBe(false);
  }
});

test("허용되지 않은 주소면 yt-dlp를 아예 실행하지 않는다", async () => {
  const dataDir = await tempDataDir();
  const run = vi.fn();

  await expect(
    downloadViaYtdlp(dataDir, "r1", "https://evil.example/reel/x/", run),
  ).rejects.toThrow(/주소/);
  expect(run).not.toHaveBeenCalled();
});

test("받아온 파일을 릴스 id 이름으로 캐시에 놓는다", async () => {
  const dataDir = await tempDataDir();

  const result = await downloadViaYtdlp(
    dataDir,
    "r1",
    "https://www.instagram.com/reel/Db458XCB9RH/",
    fakeRunner("hello"),
  );

  expect(result).toEqual({ fileName: "r1.mp4", bytes: 5 });
  expect(await readFile(join(videoCacheDir(dataDir), "r1.mp4"), "utf8")).toBe("hello");
});

test("yt-dlp가 어떤 이름으로 저장하든 캐시 이름은 릴스 id로 맞춘다", async () => {
  const dataDir = await tempDataDir();

  const result = await downloadViaYtdlp(
    dataDir,
    "r1",
    "https://www.instagram.com/reel/Db458XCB9RH/",
    fakeRunner("x", "Db458XCB9RH.mp4"),
  );

  expect(result.fileName).toBe("r1.mp4");
});

test("작업 디렉토리는 남기지 않는다", async () => {
  const dataDir = await tempDataDir();
  await downloadViaYtdlp(
    dataDir,
    "r1",
    "https://www.instagram.com/reel/Db458XCB9RH/",
    fakeRunner("x"),
  );

  // 캐시 디렉토리에 mp4 하나만 남아야 한다 — 중간 산출물이 쌓이면 다음 실행이 헷갈린다.
  expect(await readdir(videoCacheDir(dataDir))).toEqual(["r1.mp4"]);
});

test("yt-dlp가 실패하면 캐시에 아무것도 남기지 않는다", async () => {
  const dataDir = await tempDataDir();
  const run: YtdlpRunner = async () => {
    throw new Error("ERROR: Unsupported URL");
  };

  await expect(
    downloadViaYtdlp(dataDir, "r1", "https://www.instagram.com/reel/Db458XCB9RH/", run),
  ).rejects.toThrow(/Unsupported URL/);

  await mkdir(videoCacheDir(dataDir), { recursive: true });
  expect(await readdir(videoCacheDir(dataDir))).toEqual([]);
});

test("yt-dlp가 아무 파일도 남기지 않으면 실패로 본다", async () => {
  const dataDir = await tempDataDir();
  const run: YtdlpRunner = async () => {};

  await expect(
    downloadViaYtdlp(dataDir, "r1", "https://www.instagram.com/reel/Db458XCB9RH/", run),
  ).rejects.toThrow(/받지 못했습니다/);
});

test("상한을 넘는 파일은 캐시에 두지 않는다", async () => {
  const dataDir = await tempDataDir();
  // MAX_VIDEO_BYTES(200MB)를 실제로 쓰지 않고 한도만 낮춰 확인한다.
  await expect(
    downloadViaYtdlp(
      dataDir,
      "r1",
      "https://www.instagram.com/reel/Db458XCB9RH/",
      fakeRunner("123456"),
      5,
    ),
  ).rejects.toThrow(/너무 큽니다/);

  await mkdir(videoCacheDir(dataDir), { recursive: true });
  expect(await readdir(videoCacheDir(dataDir))).toEqual([]);
});

test("경로로 쓸 수 없는 릴스 id는 실행 전에 막는다", async () => {
  const dataDir = await tempDataDir();
  const run = vi.fn();

  await expect(
    downloadViaYtdlp(dataDir, "../../etc/passwd", "https://www.instagram.com/reel/x/", run),
  ).rejects.toThrow();
  expect(run).not.toHaveBeenCalled();
});
