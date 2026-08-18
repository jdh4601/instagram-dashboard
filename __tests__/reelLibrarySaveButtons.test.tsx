import { renderToStaticMarkup } from "react-dom/server";
import { SaveHookButton, SaveStoryFormatButton } from "@/components/ReelLibrarySaveButtons";
import type { Reel, ReelAnalysis } from "@/lib/schemas";

const reel: Reel = {
  id: "r1",
  postedAt: "2026-08-01T00:00:00Z",
  durationSec: 40,
  views: 12000,
  reach: 9000,
  likes: 300,
  comments: 40,
  saves: 120,
  shares: 60,
  avgWatchTimeSec: 18,
};

const analysis = {
  hook: {
    line: "월 천만원 버는 1인 창업가는 이걸 안 합니다",
    type: "personal-experience",
    template: "[목표]를 이룬 사람은 [행동]을 안 합니다",
    why: "통념을 부정한다",
  },
  story: {
    formatId: "heros-journey",
    confidence: "high",
    rationale: "근거",
    beats: [{ beatId: "intro", present: true, summary: "도입" }],
    secretSauceMet: "지킨 것",
    secretSauceMissed: "놓친 것",
  },
} as ReelAnalysis;

test("훅 저장 버튼은 어느 유형으로 담기는지 미리 보여준다", () => {
  const html = renderToStaticMarkup(<SaveHookButton reel={reel} analysis={analysis} />);

  expect(html).toContain("훅 저장하기");
  // personal-experience는 보관함의 경험담 서랍으로 간다.
  expect(html).toContain("경험담");
});

test("훅 문장이 없으면 저장 버튼을 아예 내지 않는다", () => {
  const empty = { ...analysis, hook: { ...analysis.hook, line: "  " } } as ReelAnalysis;
  expect(renderToStaticMarkup(<SaveHookButton reel={reel} analysis={empty} />)).toBe("");
});

test("포맷 저장 버튼은 어느 포맷으로 담기는지 미리 보여준다", () => {
  const html = renderToStaticMarkup(<SaveStoryFormatButton reelId="r1" story={analysis.story} />);

  expect(html).toContain("포맷 저장하기");
  expect(html).toContain("히어로즈 저니");
});
