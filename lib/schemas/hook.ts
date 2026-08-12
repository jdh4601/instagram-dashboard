import { z } from "zod";

/**
 * 훅 보관함 도메인.
 *
 * 잘된 릴스의 첫 문장을 손으로 모아 두는 북마크다. 자동 추출은 범위 밖이라
 * 모든 필드가 사람이 입력한 값이고, 그래서 검증이 저장 직전의 유일한 관문이다.
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

// 훅 문장은 릴스 첫 3초에 들어가는 한 줄이다. 이보다 길면 훅이 아니라 대본이라
// 보관함의 스캔 가능성이 무너진다.
const MAX_HOOK_TEXT = 200;
const MAX_NOTE = 1000;

// 훅 행이 원본 링크를 <a href>로 그대로 걸기 때문에, http(s)가 아닌 스킴이
// 저장소에 들어오면 클릭 한 번이 스크립트 실행이 된다. 화면이 아니라 여기서 막는다.
const httpUrl = z
  .string()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "http 또는 https로 시작하는 주소여야 합니다",
  });

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
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Hook = z.infer<typeof HookSchema>;

// 생성 요청 본문. id와 시각은 서버가 정한다 — 클라이언트가 보낸 값을 믿으면
// 남의 훅을 덮어쓰거나 정렬을 흔들 수 있다.
export const HookDraftSchema = HookSchema.omit({
  id: true,
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
