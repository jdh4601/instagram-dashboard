import { expect, test } from "vitest";
import { improvedStoryToScript } from "@/lib/analysis/improvedStoryScript";
import type { ImprovedStory } from "@/lib/schemas";

const improved: ImprovedStory = {
  formatId: "about-me",
  hookType: "contrarian",
  premise: "깨달음 비트를 세워 감정 연결을 만든다",
  beats: [
    { beatId: "intro", line: "고등학교를 자퇴했습니다.", startSec: 0, endSec: 3, origin: "rewritten", note: "인물부터" },
    { beatId: "epiphany", line: "옷이 아니라 감정을 판다는 걸 알았습니다.", startSec: 3, endSec: 9, origin: "added", note: "빠진 비트" },
  ],
};

test("첫 비트는 후킹으로 부르고 유형을 붙인다", () => {
  const script = improvedStoryToScript(improved);

  expect(script).toContain("후킹");
  expect(script).toContain("역발상");
  expect(script).toContain("0-3s");
  expect(script).toContain("고등학교를 자퇴했습니다.");
});

test("두 번째 비트부터는 포맷의 비트 라벨을 쓴다", () => {
  const script = improvedStoryToScript(improved);

  expect(script).toContain("깨달음");
});

test("복사본은 유지한 포맷을 밝힌다", () => {
  const script = improvedStoryToScript(improved);

  expect(script).toContain("어바웃 미");
});

test("원본에서 달라진 것 목록은 싣지 않는다", () => {
  const script = improvedStoryToScript(improved);

  expect(script).not.toContain("달라진 것");
});

test("모르는 비트 id는 라벨 대신 id를 그대로 쓴다", () => {
  const script = improvedStoryToScript({
    ...improved,
    beats: [improved.beats[0], { ...improved.beats[1], beatId: "unknown-beat" }],
  });

  // 라벨을 못 찾았다고 빈칸으로 두면 복사본이 무엇인지 알 수 없게 된다.
  expect(script).toContain("unknown-beat");
});
