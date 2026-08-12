import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ImprovedStoryTab } from "@/components/ImprovedStoryTab";
import type { ImprovedStory } from "@/lib/schemas";

const improved: ImprovedStory = {
  formatId: "about-me",
  hookType: "contrarian",
  premise: "깨달음 비트를 세워 감정 연결을 만든다",
  beats: [
    { beatId: "intro", line: "고등학교를 자퇴했습니다.", startSec: 0, endSec: 3, origin: "rewritten", note: "인물부터 세운다" },
    { beatId: "epiphany", line: "옷이 아니라 감정을 판다는 걸 알았습니다.", startSec: 3, endSec: 9, origin: "added", note: "빠진 비트를 채운다" },
  ],
};

function render(props: Partial<Parameters<typeof ImprovedStoryTab>[0]> = {}): string {
  return renderToStaticMarkup(
    <ImprovedStoryTab improved={null} busy={false} onGenerate={() => undefined} {...props} />,
  );
}

test("전개안이 없으면 생성 버튼을 보여준다", () => {
  const html = render();

  expect(html).toContain("전개안 생성");
  expect(html).toContain("아직 전개안이 없습니다");
});

test("전개안이 있으면 비트별 문장과 타임코드를 보여준다", () => {
  const html = render({ improved });

  expect(html).toContain("고등학교를 자퇴했습니다.");
  expect(html).toContain("0-3s");
  // 비트 id가 아니라 카탈로그의 한국어 라벨로 읽혀야 한다.
  expect(html).toContain("깨달음");
});

test("첫 비트는 포맷 라벨 대신 후킹으로 부르고 유형을 단다", () => {
  const html = render({ improved });

  expect(html).toContain("후킹");
  expect(html).toContain("역발상");
  // about-me의 첫 비트 라벨은 출발점이지만, 실제로는 훅이라 그렇게 부르지 않는다.
  expect(html).not.toContain("출발점");
});

test("원본 대비 무엇이 바뀌었는지 칸마다 표시한다", () => {
  const html = render({ improved });

  expect(html).toContain("고쳐 씀");
  expect(html).toContain("새로 넣음");
});

test("원본에서 달라진 것 묶음은 더 보여주지 않는다", () => {
  const html = render({ improved });

  expect(html).not.toContain("달라진 것");
});

test("유지한 포맷을 밝힌다", () => {
  const html = render({ improved });

  expect(html).toContain("어바웃 미");
  expect(html).toContain("유지");
});

test("생성 중에는 버튼을 잠근다", () => {
  const html = render({ busy: true });

  expect(html).toContain("생성 중…");
  expect(html).toContain("disabled");
});

test("손가락으로 누를 수 있는 크기를 지킨다", () => {
  expect(render()).toContain("min-h-11");
});
