import { HOOK_CATEGORIES, HOOK_CATEGORY_LABELS, type HookCategory } from "@/lib/schemas/hook";
import { STORY_FORMATS } from "@/lib/analysis/storyFormats";

export interface BreakdownHookSpec {
  key: HookCategory;
  ko: string;
  en: string;
  desc: string;
}

/**
 * 해체가 쓰는 도입 분류.
 *
 * 예전에는 16종(부정 선언형·숫자 충격형 …)이었다. 갈래가 너무 잘아 리포트에서
 * 무엇으로 분류됐는지 한눈에 읽히지 않았고, 보관함의 5종과도 따로 놀았다.
 * 이제 보관함과 같은 5종만 쓴다 — 같은 영상을 두 화면에서 같은 말로 부르게 된다.
 */
export const BREAKDOWN_HOOK_TAXONOMY: BreakdownHookSpec[] = [
  {
    key: "problem",
    ko: HOOK_CATEGORY_LABELS.problem,
    en: "The Problem",
    desc: "시청자가 이미 겪고 있는 통증·손해를 첫 문장에서 짚는다.",
  },
  {
    key: "contrarian",
    ko: HOOK_CATEGORY_LABELS.contrarian,
    en: "The Contrarian",
    desc: "통념을 정면으로 부정하거나 관점을 뒤집으며 연다.",
  },
  {
    key: "experience",
    ko: HOOK_CATEGORY_LABELS.experience,
    en: "The Experience",
    desc: "화자가 직접 겪은 사건·실패·고백에서 시작한다.",
  },
  {
    key: "curiosity",
    ko: HOOK_CATEGORY_LABELS.curiosity,
    en: "The Curiosity",
    desc: "결과나 방법을 감춘 채 확인하고 싶게 만든다.",
  },
  {
    key: "authority",
    ko: HOOK_CATEGORY_LABELS.authority,
    en: "The Authority",
    desc: "수치·이력·증언처럼 검증 가능한 근거를 먼저 세운다.",
  },
];

// HOOK_CATEGORIES 순서와 어긋나면 화면의 5칸이 보관함 필터와 다른 순서로 서고,
// 새 분류를 추가하고 여기 빠뜨리면 리포트가 그 분류를 그리지 못한다.
if (BREAKDOWN_HOOK_TAXONOMY.length !== HOOK_CATEGORIES.length) {
  throw new Error("해체 훅 분류가 보관함 분류 5종과 어긋납니다");
}

export const BREAKDOWN_HOOK_BY_KEY = new Map(
  BREAKDOWN_HOOK_TAXONOMY.map((spec) => [spec.key, spec] as const),
);

export function taxonomyForPrompt(): string {
  return BREAKDOWN_HOOK_TAXONOMY.map(
    (spec) => `- ${spec.key}: ${spec.ko} (${spec.en}) — ${spec.desc}`,
  ).join("\n");
}

/** 스토리텔링 포맷 10종. 해체가 전체 전개를 어느 포맷으로 볼지 고르는 목록이다. */
export function storyFormatsForPrompt(): string {
  return STORY_FORMATS.map(
    (format) => `- ${format.id}: ${format.label} — ${format.description}`,
  ).join("\n");
}
