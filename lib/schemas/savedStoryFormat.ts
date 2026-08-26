import { z } from "zod";
import { ReelStoryFormatSchema } from "@/lib/schemas/reelAnalysis";

/**
 * 스토리텔링 포맷 저장소 도메인.
 *
 * `lib/analysis/storyFormats.ts`의 10종 카탈로그는 코드 안의 상수라 늘 그대로 있고,
 * 여기 담기는 것은 "내 릴스가 그 포맷을 실제로 어떻게 썼는가"의 스냅샷이다. 분석은
 * 릴스에 캐시돼 있다가 다시 돌리면 덮어써지므로, 저장 시점의 판정을 통째로 복사해
 * 둬야 나중에 같은 포맷의 사례를 견줘 볼 수 있다.
 */

// 화면이 <a href>·<img src>로 그대로 거는 값이라, 저장소에 닿기 전에 스킴을 막는다.
const httpUrl = z
  .string()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "http 또는 https로 시작하는 주소여야 합니다",
  });

/** 이 판정이 어느 릴스에서 나왔는지. 목록에서 원본으로 되돌아가는 유일한 실마리다. */
export const SavedStoryFormatSourceSchema = z.object({
  reelId: z.string().min(1),
  /** 사람이 알아볼 제목(캡션 첫 줄). 저장 시점의 문구를 그대로 둔다. */
  title: z.string().trim().min(1).max(120),
  postedAt: z.string(),
  permalink: httpUrl.optional(),
  thumbnailUrl: httpUrl.optional(),
  views: z.number().nonnegative().optional(),
});

export const SavedStoryFormatSchema = z.object({
  /** 릴스 id를 그대로 쓴다 — 같은 릴스를 두 번 저장하면 새 줄이 아니라 갱신이어야 한다. */
  id: z.string().min(1),
  /** 저장 시점의 포맷 판정 전문. 유형(formatId)도 여기 들어 있다. */
  story: ReelStoryFormatSchema,
  source: SavedStoryFormatSourceSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SavedStoryFormat = z.infer<typeof SavedStoryFormatSchema>;

/**
 * 저장 요청 본문.
 *
 * 판정 내용은 받지 않는다 — 서버가 저장된 릴스의 분석에서 직접 읽어야 화면에 보이는
 * 것과 저장된 것이 갈라지지 않고, 클라이언트가 지어낸 비트가 저장소에 들어오지 않는다.
 */
export const SaveStoryFormatRequestSchema = z.object({ reelId: z.string().min(1) });
