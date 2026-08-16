import { z } from "zod";

/**
 * 광고 결과 유형. Ad Center는 부스트 목표에 따라 다른 자를 돌려준다 —
 * 프로필 방문과 링크 클릭은 서로 다른 행동이라 한 열에 섞으면 순위가 거짓말이 된다.
 */
export const AD_RESULT_TYPES = ["PROFILE_VISIT", "LINK_CLICK"] as const;
export type AdResultType = (typeof AD_RESULT_TYPES)[number];

export const AD_RESULT_LABELS: Record<AdResultType, string> = {
  PROFILE_VISIT: "프로필 방문",
  LINK_CLICK: "링크 클릭",
};

/**
 * 게시물 한 건에 태운 광고. 수동으로 옮겨 적은 기록이다.
 *
 * 인스타그램 앱 '홍보하기'로 만든 부스트는 Ad Center에만 남고 표준 광고 객체로
 * 올라오지 않아 Marketing API가 영영 볼 수 없다(Ads Manager UI도 똑같이 0을 보고한다).
 * 그 구간을 메우는 유일한 경로라서, API 연동이 붙은 뒤에도 이 기록은 살아 있어야 한다.
 */
export const AdSpendSchema = z.object({
  /** 오가닉 게시물 id. 이 값으로 저장된 게시물의 지표와 맞물린다. */
  mediaId: z.string().min(1),
  /** 부스트를 시작한 날(YYYY-MM-DD). 게시일과 다를 수 있다. */
  boostedAt: z.string(),
  /** 실제 소진액(원). 예산이 아니라 쓴 돈이다 — 예산은 남기고 끝나는 경우가 잦다. */
  spend: z.number().nonnegative(),
  /** 광고 노출 횟수(Ad Center의 "Views") */
  views: z.number().nonnegative(),
  /** 광고가 닿은 사람 수(Ad Center의 "Viewers") */
  reach: z.number().nonnegative(),
  /** 목표 행동 수. resultType이 무엇인지 봐야 의미가 정해진다. */
  resultCount: z.number().nonnegative(),
  resultType: z.enum(AD_RESULT_TYPES),
  /** 어디서 옮겨 적었는지. 지금은 Ad Center 하나뿐이지만 출처를 잃지 않는다. */
  source: z.literal("AD_CENTER"),
});
export type AdSpend = z.infer<typeof AdSpendSchema>;
