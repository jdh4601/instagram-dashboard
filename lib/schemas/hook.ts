import { z } from "zod";

/**
 * 훅 보관함 도메인.
 *
 * 잘된 릴스의 첫 문장을 손으로 모아 두는 북마크다. 기본 필드는 사람이 입력하고,
 * 선택적인 breakdown만 서버가 링크의 영상에서 만든다. 둘 다 저장 직전에 검증한다.
 */

// 훅을 고르는 기준이 되는 화법 분류. 화면 라벨과 저장 값을 분리해 두면
// 나중에 라벨 문구를 바꿔도 이미 저장된 훅이 분류를 잃지 않는다.
export const HOOK_CATEGORIES = [
  "problem",
  "contrarian",
  "experience",
  "curiosity",
  "authority",
] as const;

const HookCategorySchema = z.enum(HOOK_CATEGORIES);
export type HookCategory = z.infer<typeof HookCategorySchema>;

export const HOOK_CATEGORY_LABELS: Record<HookCategory, string> = {
  problem: "문제 제기",
  contrarian: "역발상",
  experience: "경험담",
  curiosity: "호기심",
  authority: "권위·근거",
};

// 훅 행과 해체 결과가 원본 링크를 <a href>로 그대로 걸기 때문에, http(s)가 아닌
// 스킴은 저장소에 닿기 전에 막는다.
const httpUrl = z
  .string()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "http 또는 https로 시작하는 주소여야 합니다",
  });

/**
 * reel-breakdown 스킬이 쓰는 더 세밀한 훅 분류.
 *
 * 보관함의 5개 category는 사용자가 직접 붙인 실무용 분류이고, 이 16개 값은 영상을
 * 해체하면서 관찰한 도입 방식이다. 둘을 합치거나 덮어쓰지 않아야 기존 카탈로그가
 * 흔들리지 않고, 같은 릴스를 두 관점으로 비교할 수 있다.
 */
export const BREAKDOWN_HOOK_TYPES = [
  "negation",
  "number",
  "secret",
  "rank",
  "mindread",
  "demo",
  "zoomout",
  "metaphor",
  "credential",
  "testimony",
  "warning",
  "challenge",
  "contrast",
  "story",
  "declaration",
  "confession",
] as const;
const BreakdownHookTypeSchema = z.enum(BREAKDOWN_HOOK_TYPES);
export type BreakdownHookType = z.infer<typeof BreakdownHookTypeSchema>;

export const BreakdownBeatSchema = z
  .object({
    start: z.number().nonnegative(),
    end: z.number().positive(),
    label: z.string().trim().min(1).max(80),
    /** 화면에서 실제로 확인한 장면·자막만 쓴다. */
    scene: z.string().trim().min(1).max(1200),
    /** 음성의 원래 언어. 음성이 한국어면 translation과 같아도 된다. */
    original: z.string().trim().min(1).max(4000),
    translation: z.string().trim().min(1).max(4000),
    /** 경로가 아니라 asset 라우트 아래에서 허용할 파일명만 저장한다. */
    clipFile: z.string().regex(/^\d{2}\.mp4$/),
    posterFile: z.string().regex(/^\d{4}\.jpg$/),
  })
  .refine((beat) => beat.end > beat.start, { message: "구간 끝은 시작보다 뒤여야 합니다" });
export type BreakdownBeat = z.infer<typeof BreakdownBeatSchema>;

/**
 * 구간 개수의 절대 경계. 실제 목표 개수는 영상 길이에 맞춰 정해지므로(beatBudget),
 * 여기서는 "리포트가 성립하는 최소"와 "클립 인코딩이 감당할 최대"만 막는다.
 */
export const MIN_BREAKDOWN_BEATS = 2;
export const MAX_BREAKDOWN_BEATS = 20;

export const HookBreakdownSchema = z.object({
  reelUrl: httpUrl,
  /** 파일 시스템 디렉터리를 고르는 서버 발급 키. 요청 경로를 그대로 저장하지 않는다. */
  assetKey: z.string().regex(/^[A-Za-z0-9_-]+$/),
  durationSec: z.number().positive(),
  cuts: z.array(z.number().nonnegative()),
  hookType: BreakdownHookTypeSchema,
  beats: z.array(BreakdownBeatSchema).min(MIN_BREAKDOWN_BEATS).max(MAX_BREAKDOWN_BEATS),
  generatedAt: z.string(),
});
export type HookBreakdown = z.infer<typeof HookBreakdownSchema>;

// 훅 문장은 릴스 첫 3초에 들어가는 한 줄이다. 이보다 길면 훅이 아니라 대본이라
// 보관함의 스캔 가능성이 무너진다.
const MAX_HOOK_TEXT = 200;
const MAX_NOTE = 1000;

// 앞의 @는 표시할 때 붙인다. 저장 값에는 핸들만 담아야 "@@handle"이 생기지 않는다.
const instagramHandle = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[A-Za-z0-9._]+$/, "인스타그램 핸들은 영문·숫자·마침표·밑줄만 쓸 수 있습니다");

export const HookSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1).max(MAX_HOOK_TEXT),
  category: HookCategorySchema,
  /** 영감을 준 계정. 내가 직접 쓴 훅이면 비어 있다. */
  sourceHandle: instagramHandle.optional(),
  sourceUrl: httpUrl.optional(),
  thumbnailUrl: httpUrl.optional(),
  /** 원본 릴스의 조회수. 훅의 설득력을 가늠하는 근거라 정렬 기준이 된다. */
  views: z.number().nonnegative().optional(),
  isFavorite: z.boolean(),
  note: z.string().max(MAX_NOTE).optional(),
  /** 링크에서 생성한 장면별 구조 리포트. 없으면 아직 해체하지 않은 훅이다. */
  breakdown: HookBreakdownSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Hook = z.infer<typeof HookSchema>;

// 생성 요청 본문. id와 시각은 서버가 정한다 — 클라이언트가 보낸 값을 믿으면
// 남의 훅을 덮어쓰거나 정렬을 흔들 수 있다.
export const HookDraftSchema = HookSchema.omit({
  id: true,
  breakdown: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  isFavorite: z.boolean().optional(),
});
export type HookDraft = z.infer<typeof HookDraftSchema>;

// 수정 요청 본문. 부분 갱신이라 하트 토글도 같은 라우트로 처리한다.
// 빈 객체는 "아무것도 안 바꿈"이 아니라 실수로 읽어야 하므로 최소 1개를 요구한다.
export const HookPatchSchema = HookDraftSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "수정할 항목이 없습니다" },
);
