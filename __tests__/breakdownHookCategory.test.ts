import {
  HOOK_CATEGORIES,
  HookSchema,
  LEGACY_BREAKDOWN_HOOK_CATEGORY,
  type Hook,
} from "@/lib/schemas";
import { BREAKDOWN_HOOK_TAXONOMY } from "@/lib/reelBreakdown/taxonomy";

function hook(breakdown: Record<string, unknown>): unknown {
  return {
    id: "h1",
    text: "AI가 가상 스튜디오를 만들었습니다",
    category: "curiosity",
    isFavorite: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    breakdown: {
      reelUrl: "https://www.instagram.com/reel/abc/",
      assetKey: "asset",
      durationSec: 10,
      cuts: [],
      beats: [0, 1].map((index) => ({
        start: index * 5,
        end: (index + 1) * 5,
        label: "구간",
        scene: "장면",
        original: "원문",
        translation: "번역",
        clipFile: `0${index + 1}.mp4`,
        posterFile: `000${index + 1}.jpg`,
      })),
      generatedAt: "2026-08-15T00:00:00.000Z",
      ...breakdown,
    },
  };
}

test("해체 훅 분류는 보관함과 같은 5종뿐이다", () => {
  expect(BREAKDOWN_HOOK_TAXONOMY.map((spec) => spec.key)).toEqual([...HOOK_CATEGORIES]);
});

test("예전 16종으로 저장된 해체 결과도 5종으로 옮겨져 살아남는다", () => {
  // 저장소는 목록 전체를 한 번에 parse한다. 한 건이 터지면 보관함이 통째로 빈다.
  const parsed = HookSchema.parse(hook({ hookType: "negation" })) as Hook;
  expect(parsed.breakdown!.hookType).toBe("contrarian");
});

test("예전 16종 값은 모두 5종 중 하나로 옮겨진다", () => {
  for (const [legacy, category] of Object.entries(LEGACY_BREAKDOWN_HOOK_CATEGORY)) {
    expect(HOOK_CATEGORIES).toContain(category);
    const parsed = HookSchema.parse(hook({ hookType: legacy })) as Hook;
    expect(parsed.breakdown!.hookType).toBe(category);
  }
});

test("아는 값이 아니면 그대로 통과시키지 않는다", () => {
  expect(HookSchema.safeParse(hook({ hookType: "지어낸유형" })).success).toBe(false);
});

test("스토리텔링 포맷은 카탈로그 안의 값만 남는다", () => {
  const kept = HookSchema.parse(
    hook({ hookType: "curiosity", storyFormatId: "heros-journey" }),
  ) as Hook;
  expect(kept.breakdown!.storyFormatId).toBe("heros-journey");

  // 카탈로그에 없는 포맷 하나 때문에 해체 결과 전체를 잃지는 않는다.
  const dropped = HookSchema.parse(
    hook({ hookType: "curiosity", storyFormatId: "없는-포맷" }),
  ) as Hook;
  expect(dropped.breakdown!.storyFormatId).toBeUndefined();
  expect(dropped.breakdown!.beats).toHaveLength(2);
});
