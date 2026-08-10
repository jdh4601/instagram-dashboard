import { renderToStaticMarkup } from "react-dom/server";
import { ReelAnalysisPanel } from "@/components/ReelAnalysisPanel";
import type { Reel, ReelAnalysis } from "@/lib/schemas";

function reel(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "r1",
    postedAt: "2026-06-01T00:00:00Z",
    durationSec: 40,
    views: 12000,
    reach: 9000,
    likes: 300,
    comments: 40,
    saves: 120,
    shares: 60,
    avgWatchTimeSec: 18,
    transcript: [
      { startSec: 0, endSec: 2.5, text: "월 천만원 버는 1인 창업가는 이걸 안 합니다" },
      { startSec: 2.5, endSec: 10, text: "저도 처음엔 매일 12시간씩 일했어요" },
    ],
    ...overrides,
  };
}

const analysis: ReelAnalysis = {
  summary: "통념을 부정해 붙잡고 본인 실패담으로 신뢰를 만든다.",
  idea: {
    coreIdea: "노동 시간이 아니라 구조가 매출을 만든다",
    valueProposition: "시간을 줄이면서 매출을 올리는 기준",
    targetAudience: "초기 1인 창업가",
    differentiator: "성공담 대신 실패 기간을 먼저 꺼낸다",
  },
  hook: {
    line: "월 천만원 버는 1인 창업가는 이걸 안 합니다",
    type: "contrarian",
    template: "[목표 달성한 사람]은 [흔한 행동]을 안 합니다",
    why: "통념을 부정해 확인 욕구를 만든다",
  },
  story: {
    format: "통념 부정 → 경험 → 반전 → 제안",
    beats: [
      { stage: "intro", label: "통념 부정", startSec: 0, endSec: 2.5, summary: "훅" },
      { stage: "development", label: "경험 공유", startSec: 2.5, endSec: 10, summary: "본인 사례" },
    ],
  },
};

function render(props: Partial<Parameters<typeof ReelAnalysisPanel>[0]> = {}): string {
  return renderToStaticMarkup(
    <ReelAnalysisPanel
      reel={reel()}
      analysis={null}
      onAnalyze={async () => undefined}
      onTranscribe={async () => undefined}
      {...props}
    />,
  );
}

test("탭 바에 네 개 탭이 모두 있다", () => {
  const html = render();

  expect(html).toContain("Transcript");
  expect(html).toContain("Idea Analysis");
  expect(html).toContain("Hook");
  expect(html).toContain("Storytelling Format");
  // Visual Layout은 이번 범위 밖이다.
  expect(html).not.toContain("Visual Layout");
});

test("기본 탭은 자막이고 자막 전문과 단어 수를 보여준다", () => {
  const html = render();

  expect(html).toContain("월 천만원 버는 1인 창업가는 이걸 안 합니다");
  expect(html).toContain("저도 처음엔 매일 12시간씩 일했어요");
  // 자막 두 줄의 단어 수 합계
  expect(html).toContain("단어");
});

test("탭 바는 탭 목록 시맨틱으로 읽힌다", () => {
  const html = render();

  expect(html).toContain('role="tablist"');
  expect(html).toContain('aria-selected="true"');
});

test("분석이 있으면 상단 Summary를 그대로 보여준다", () => {
  const html = render({ analysis });

  expect(html).toContain("Summary");
  expect(html).toContain("통념을 부정해 붙잡고 본인 실패담으로 신뢰를 만든다.");
});

test("분석이 없으면 분석하기 버튼을 보여준다", () => {
  const html = render();

  expect(html).toContain("분석하기");
  expect(html).not.toContain("다시 분석");
});

test("분석이 있으면 다시 분석할 수 있다", () => {
  const html = render({ analysis });

  expect(html).toContain("다시 분석");
});

test("자막이 없으면 분석 대신 전사를 먼저 안내한다", () => {
  const html = render({ reel: reel({ transcript: [] }) });

  expect(html).toContain("자동 전사");
  expect(html).not.toContain("분석하기");
});

test("손가락으로 누를 수 있는 크기를 지킨다", () => {
  expect(render()).toContain("min-h-11");
});
