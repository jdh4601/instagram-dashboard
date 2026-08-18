import { HookDraftSchema, HOOK_TYPES, type Reel, type ReelAnalysis } from "@/lib/schemas";
import {
  ANALYSIS_HOOK_CATEGORY,
  buildHookDraftFromReel,
} from "@/lib/ui/hookDraftFromAnalysis";

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
    permalink: "https://www.instagram.com/reel/abc/",
    thumbnailUrl: "https://cdn.example.com/thumb.jpg",
    ...overrides,
  };
}

function analysis(hook: Partial<ReelAnalysis["hook"]> = {}): ReelAnalysis {
  return {
    summary: "요약",
    idea: {
      coreIdea: "핵심",
      valueProposition: "가치",
      targetAudience: "타깃",
      differentiator: "차별점",
    },
    hook: {
      line: "월 천만원 버는 1인 창업가는 이걸 안 합니다",
      type: "contrarian",
      template: "[목표 달성한 사람]은 [흔한 행동]을 안 합니다",
      why: "통념을 부정해 확인 욕구를 만든다",
      ...hook,
    },
    story: {
      formatId: "heros-journey",
      confidence: "high",
      rationale: "근거",
      beats: [{ beatId: "intro", present: true, summary: "도입" }],
      secretSauceMet: "지킨 것",
      secretSauceMissed: "놓친 것",
    },
    principles: [],
  } as ReelAnalysis;
}

test("분석의 훅 유형 7종이 모두 보관함 분류를 갖는다", () => {
  for (const type of HOOK_TYPES) {
    expect(ANALYSIS_HOOK_CATEGORY[type]).toBeTruthy();
  }
});

test("훅 문장·유형·원본 링크를 그대로 옮긴 초안을 만든다", () => {
  const draft = buildHookDraftFromReel(reel(), analysis());

  expect(draft).not.toBeNull();
  expect(draft!.text).toBe("월 천만원 버는 1인 창업가는 이걸 안 합니다");
  expect(draft!.category).toBe("contrarian");
  expect(draft!.sourceUrl).toBe("https://www.instagram.com/reel/abc/");
  expect(draft!.thumbnailUrl).toBe("https://cdn.example.com/thumb.jpg");
  expect(draft!.views).toBe(12000);
  // 템플릿과 이유를 잃으면 보관함에서 왜 담았는지 알 수 없다.
  expect(draft!.note).toContain("[목표 달성한 사람]은 [흔한 행동]을 안 합니다");
  expect(draft!.note).toContain("통념을 부정해 확인 욕구를 만든다");
});

test("만들어진 초안은 저장 스키마를 그대로 통과한다", () => {
  const draft = buildHookDraftFromReel(reel(), analysis());
  expect(HookDraftSchema.safeParse(draft).success).toBe(true);
});

test("200자를 넘는 훅 문장은 잘라서 저장 한도를 넘지 않는다", () => {
  const draft = buildHookDraftFromReel(reel(), analysis({ line: "가".repeat(300) }));

  expect(draft!.text.length).toBe(200);
  expect(HookDraftSchema.safeParse(draft).success).toBe(true);
});

test("http(s)가 아닌 링크는 담지 않는다", () => {
  const draft = buildHookDraftFromReel(
    reel({ permalink: "javascript:alert(1)", thumbnailUrl: "data:image/png;base64,AAAA" }),
    analysis(),
  );

  expect(draft!.sourceUrl).toBeUndefined();
  expect(draft!.thumbnailUrl).toBeUndefined();
});

test("훅 문장이 비면 저장할 게 없어 초안을 만들지 않는다", () => {
  expect(buildHookDraftFromReel(reel(), analysis({ line: "   " }))).toBeNull();
});
