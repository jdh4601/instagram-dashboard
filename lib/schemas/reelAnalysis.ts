import { z } from "zod";
import { STORY_FORMAT_IDS } from "@/lib/analysis/storyFormats";

/**
 * 릴스 상세의 분석 탭 3개(Idea Analysis · Hook · Storytelling Format)를 담는 스키마.
 *
 * 탭마다 따로 호출하면 같은 자막을 네 번 보내게 되어 비용이 그대로 4배가 된다.
 * 한 번의 LLM 호출로 이 객체를 통째로 받아 릴스에 캐시한다.
 *
 * `lib/schemas/index.ts`가 아니라 별도 모듈에 둔 이유: 릴스 스키마 본문에 끼워 넣으면
 * 같은 파일을 동시에 늘리는 다른 작업과 충돌한다.
 */

const ReelIdeaAnalysisSchema = z.object({
  /** 이 릴스가 말하는 한 가지 */
  coreIdea: z.string(),
  /** 시청자가 얻는 것 */
  valueProposition: z.string(),
  /** 누구에게 하는 말인가 */
  targetAudience: z.string(),
  /** 같은 주제의 다른 영상과 갈라지는 지점 */
  differentiator: z.string(),
});
export type ReelIdeaAnalysis = z.infer<typeof ReelIdeaAnalysisSchema>;

/**
 * 훅 유형. 분류를 열거형으로 고정해 탭에서 색·설명을 붙일 수 있게 한다.
 * 모델이 어디에도 맞추지 못하면 other로 보낸다.
 */
export const HOOK_TYPES = [
  "problem",
  "contrarian",
  "personal-experience",
  "curiosity",
  "result-proof",
  "how-to",
  "other",
] as const;
const HookTypeSchema = z.enum(HOOK_TYPES);
export type HookType = z.infer<typeof HookTypeSchema>;

const ReelHookAnalysisSchema = z.object({
  /** 첫 3초에 실제로 나온 문장(자막 인용) */
  line: z.string(),
  type: HookTypeSchema,
  /** 다른 주제에 그대로 갈아 끼울 수 있게 일반화한 형태. 예: "If you [action], I will [incentive]." */
  template: z.string(),
  /** 이 훅이 먹히는(혹은 안 먹힌) 이유 */
  why: z.string(),
});
export type ReelHookAnalysis = z.infer<typeof ReelHookAnalysisSchema>;

/**
 * 비트는 포맷마다 다르다. 그래서 stage 열거형이 아니라 카탈로그의 비트 id를 쓴다
 * — 어떤 비트를 빠뜨렸는지는 그 포맷의 표준 시퀀스와 견줘야만 말할 수 있다.
 */
const StoryBeatSchema = z.object({
  /** lib/analysis/storyFormats.ts의 비트 id */
  beatId: z.string().min(1),
  /** 이 비트가 실제로 대본에 있었는가 */
  present: z.boolean(),
  startSec: z.number().nonnegative().optional(),
  endSec: z.number().nonnegative().optional(),
  summary: z.string(),
  /** 근거가 되는 자막 한 줄 */
  quote: z.string().optional(),
});
export type StoryBeat = z.infer<typeof StoryBeatSchema>;

export const FORMAT_CONFIDENCE = ["high", "medium", "low"] as const;
const ConfidenceSchema = z.enum(FORMAT_CONFIDENCE);
export type FormatConfidence = z.infer<typeof ConfidenceSchema>;

const ReelStoryFormatSchema = z.object({
  /** 카탈로그의 10개 포맷 중 하나 */
  formatId: z.enum(STORY_FORMAT_IDS as [string, ...string[]]),
  confidence: ConfidenceSchema,
  /** 왜 이 포맷으로 봤는지 */
  rationale: z.string(),
  /** 애매한 경우의 차선 후보 */
  alternateFormatId: z.enum(STORY_FORMAT_IDS as [string, ...string[]]).optional(),
  beats: z.array(StoryBeatSchema).min(1),
  /** 이 포맷을 아웃라이어로 만드는 조건 중 지킨 것 */
  secretSauceMet: z.string(),
  /** 같은 조건 중 놓친 것 */
  secretSauceMissed: z.string(),
});
export type ReelStoryFormat = z.infer<typeof ReelStoryFormatSchema>;

/** Short-Form Storytelling Principles의 8가지 스크립트 원리 */
export const PRINCIPLE_IDS = [
  "curiosity-contrast",
  "speed-to-value",
  "value-density",
  "clarity",
  "absorption",
  "anticipation",
  "emotional-resonance",
  "rhythm",
] as const;
export type PrincipleId = (typeof PRINCIPLE_IDS)[number];

export const PRINCIPLE_LABELS: Record<PrincipleId, string> = {
  "curiosity-contrast": "호기심과 대비",
  "speed-to-value": "가치까지의 속도",
  "value-density": "가치 밀도",
  clarity: "명료성",
  absorption: "흡수율",
  anticipation: "기대감",
  "emotional-resonance": "감정 공명",
  rhythm: "리듬과 완급",
};

const PrincipleScoreSchema = z.object({
  id: z.enum(PRINCIPLE_IDS),
  /** 1(약함) ~ 5(강함) */
  score: z.number().int().min(1).max(5),
  /** 점수의 근거 — 자막 인용이나 계산된 수치 */
  evidence: z.string(),
  /** 이 원리를 끌어올릴 구체적인 조치 */
  fix: z.string(),
});
export type PrincipleScore = z.infer<typeof PrincipleScoreSchema>;

export const ReelAnalysisSchema = z.object({
  /** 상단 Summary 영역에 그대로 쓰는 2~3문장 */
  summary: z.string(),
  idea: ReelIdeaAnalysisSchema,
  hook: ReelHookAnalysisSchema,
  story: ReelStoryFormatSchema,
  /** 8가지 원리 점수표. 빠짐없이 8개가 와야 화면의 표가 뚫리지 않는다. */
  principles: z.array(PrincipleScoreSchema).length(PRINCIPLE_IDS.length),
  /** 캐시 시점 (서버에서 주입) */
  generatedAt: z.string().optional(),
});
export type ReelAnalysis = z.infer<typeof ReelAnalysisSchema>;
