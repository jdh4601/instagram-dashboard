import { z } from "zod";

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

/** 도입-전개-전환-마무리. 자막 흐름을 이 네 구간으로 접는다. */
export const STORY_STAGES = ["intro", "development", "turn", "closing"] as const;
const StoryStageSchema = z.enum(STORY_STAGES);
export type StoryStage = z.infer<typeof StoryStageSchema>;

const StoryBeatSchema = z.object({
  stage: StoryStageSchema,
  /** 이 비트가 하는 일을 짧게 (예: "문제 제기") */
  label: z.string(),
  startSec: z.number().nonnegative().optional(),
  endSec: z.number().nonnegative().optional(),
  summary: z.string(),
  /** 근거가 되는 자막 한 줄 */
  quote: z.string().optional(),
});
export type StoryBeat = z.infer<typeof StoryBeatSchema>;

const ReelStoryFormatSchema = z.object({
  /** 구조 이름 (예: "문제 → 반전 → 증거 → 제안") */
  format: z.string(),
  beats: z.array(StoryBeatSchema).min(1),
});
export type ReelStoryFormat = z.infer<typeof ReelStoryFormatSchema>;

export const ReelAnalysisSchema = z.object({
  /** 상단 Summary 영역에 그대로 쓰는 2~3문장 */
  summary: z.string(),
  idea: ReelIdeaAnalysisSchema,
  hook: ReelHookAnalysisSchema,
  story: ReelStoryFormatSchema,
  /** 캐시 시점 (서버에서 주입) */
  generatedAt: z.string().optional(),
});
export type ReelAnalysis = z.infer<typeof ReelAnalysisSchema>;
