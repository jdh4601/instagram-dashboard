import {
  MAX_PROBE_DURATION_SEC,
  parseFfprobeDuration,
  probeDurationSec,
  probeLocalDurationSec,
} from "@/lib/media/probeDuration";

const URL = "https://scontent.cdninstagram.com/o1/v/t2/f2/m86/AQ.mp4?oe=DEADBEEF";

test("ffprobe 출력의 초 값을 소수 첫째 자리로 읽는다", () => {
  expect(parseFfprobeDuration("62.533333\n")).toBe(62.5);
  expect(parseFfprobeDuration("38.766000")).toBe(38.8);
});

test("길이로 볼 수 없는 출력은 null이다", () => {
  expect(parseFfprobeDuration("N/A")).toBeNull();
  expect(parseFfprobeDuration("")).toBeNull();
  expect(parseFfprobeDuration("0")).toBeNull();
  expect(parseFfprobeDuration("-3.2")).toBeNull();
  // 릴스 상한을 넘는 값은 잘못 읽은 것으로 본다
  expect(parseFfprobeDuration(String(MAX_PROBE_DURATION_SEC + 1))).toBeNull();
});

test("정상 응답이면 초를 돌려준다", async () => {
  const run = vi.fn().mockResolvedValue("76.7\n");
  await expect(probeDurationSec(URL, run)).resolves.toBe(76.7);
  expect(run).toHaveBeenCalledTimes(1);
});

test("ffprobe가 없어도 예외를 던지지 않고 null을 돌려준다", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const run = vi.fn().mockRejectedValue(new Error("spawn ffprobe ENOENT"));

  await expect(probeDurationSec(URL, run)).resolves.toBeNull();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test("실패 로그에 서명된 CDN URL을 남기지 않는다", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  // execFile 오류 메시지에는 실행 명령 전체(=URL)가 들어간다
  const run = vi.fn().mockRejectedValue(new Error(`Command failed: ffprobe ${URL}`));

  await probeDurationSec(URL, run);

  const logged = warn.mock.calls.flat().join(" ");
  expect(logged).not.toContain("oe=DEADBEEF");
  warn.mockRestore();
});

test("http(s)가 아닌 입력에는 ffprobe를 실행하지 않는다", async () => {
  const run = vi.fn();
  await expect(probeDurationSec("file:///etc/passwd", run)).resolves.toBeNull();
  await expect(probeDurationSec("", run)).resolves.toBeNull();
  expect(run).not.toHaveBeenCalled();
});

const CACHED_PATH = "/workspace/data/videos/17928205134143275.mp4";

test("내려받아 둔 mp4에서도 길이를 읽는다", async () => {
  const run = vi.fn().mockResolvedValue("33.596417\n");

  await expect(probeLocalDurationSec(CACHED_PATH, run)).resolves.toBe(33.6);
  expect(run).toHaveBeenCalledWith(CACHED_PATH);
});

test("절대 경로가 아니거나 프로토콜이 붙은 입력에는 ffprobe를 실행하지 않는다", async () => {
  const run = vi.fn();

  // 캐시 경로는 항상 resolveCachedVideoPath가 만든 절대 경로다. 그 밖의 문자열은
  // ffprobe의 프로토콜 처리(http:, concat: 등)에 닿기 전에 막는다.
  await expect(probeLocalDurationSec("data/videos/r1.mp4", run)).resolves.toBeNull();
  await expect(probeLocalDurationSec("https://cdn.example/r1.mp4", run)).resolves.toBeNull();
  await expect(probeLocalDurationSec("", run)).resolves.toBeNull();
  expect(run).not.toHaveBeenCalled();
});

test("깨진 mp4를 만나도 예외를 던지지 않고 null을 돌려준다", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const run = vi.fn().mockRejectedValue(new Error("moov atom not found"));

  await expect(probeLocalDurationSec(CACHED_PATH, run)).resolves.toBeNull();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});
