import type { Band } from "@/lib/analysis/diagnosis";

/**
 * 광고의 상태와 목표를 화면 문구로 옮긴다.
 *
 * 모르는 값은 감추지 않고 원문을 그대로 보여 준다. Meta가 새 상태나 새 목표를
 * 내놓았을 때 화면이 빈칸이 되면, 값이 없는 것인지 우리가 모르는 것인지 구분할 수 없다.
 */

const STATUS_LABELS: Record<string, { label: string; band?: Band }> = {
  ACTIVE: { label: "집행 중", band: "strong" },
  PAUSED: { label: "일시중지" },
  CAMPAIGN_PAUSED: { label: "일시중지" },
  ADSET_PAUSED: { label: "일시중지" },
  PENDING_REVIEW: { label: "심사 중", band: "ok" },
  IN_PROCESS: { label: "심사 중", band: "ok" },
  PREAPPROVED: { label: "심사 중", band: "ok" },
  PENDING_BILLING_INFO: { label: "결제 정보 필요", band: "weak" },
  DISAPPROVED: { label: "반려됨", band: "weak" },
  WITH_ISSUES: { label: "문제 있음", band: "weak" },
  ARCHIVED: { label: "보관됨" },
  DELETED: { label: "삭제됨" },
};

const GOAL_LABELS: Record<string, string> = {
  THRUPLAY: "동영상 조회",
  VIDEO_VIEWS: "동영상 조회",
  LINK_CLICKS: "링크 클릭",
  LANDING_PAGE_VIEWS: "랜딩 페이지 조회",
  POST_ENGAGEMENT: "게시물 참여",
  PAGE_LIKES: "페이지 좋아요",
  PROFILE_VISIT: "프로필 방문",
  IG_PROFILE_VISIT: "프로필 방문",
  LEAD_GENERATION: "잠재 고객",
  REACH: "도달",
  IMPRESSIONS: "노출",
};

/** 계산하거나 채울 수 없는 칸. 0으로 채우면 "0이었다"로 읽힌다. */
export const NONE = "—";

export function goalLabel(goal: string | null): string {
  if (!goal) return NONE;
  return GOAL_LABELS[goal] ?? goal;
}

/**
 * 화면에 띄울 상태.
 *
 * Meta는 기간이 끝난 광고도 effective_status를 ACTIVE로 답한다. 상태만 믿으면
 * 지난달에 끝난 광고가 지금 돈을 쓰고 있는 것처럼 보이므로 종료 시각을 함께 본다.
 */
export function adUnitStatus(
  unit: { status: string; endTime?: string },
  now: Date = new Date(),
): { label: string; band?: Band } {
  const known = STATUS_LABELS[unit.status];
  if (unit.status === "ACTIVE" && unit.endTime) {
    const end = new Date(unit.endTime);
    if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) {
      return { label: "종료" };
    }
  }
  return known ?? { label: unit.status };
}
