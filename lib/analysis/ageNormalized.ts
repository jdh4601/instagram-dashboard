import type { Reel, ReelMetricSnapshot } from "@/lib/schemas";

/** 초기 성과를 견줄 기준 시점. 게시 후 이틀이면 대부분의 배포가 끝난다. */
export const AGE_TARGET_HOURS = 48;

/**
 * 목표 시점에서 이만큼까지 벗어난 기록은 받아준다. 이력이 매일 찍히지 않아
 * (실측: 26일간 14일치) 정확히 48시간짜리 기록이 없는 경우가 흔하다.
 * 이 범위를 넘으면 초기 성과가 아니라 누적 성과라 비교에 쓸 수 없다.
 */
export const AGE_SLACK_HOURS = 48;

export interface AgeNormalizedViews {
  views: number;
  /** 게시 시각부터 이 기록까지 실제 경과 시간. 48이 아닐 수 있어 함께 표기한다. */
  elapsedHours: number;
  /** 채택한 기록일 */
  date: string;
}

function elapsedHours(postedAt: string, date: string): number {
  const posted = new Date(postedAt).getTime();
  const recorded = new Date(`${date}T00:00:00Z`).getTime();
  return (recorded - posted) / 3_600_000;
}

/**
 * 게시 후 약 48시간 시점의 조회수.
 *
 * 값을 보간하지 않는다. 기록된 값만 쓰고 실제 경과 시간을 함께 돌려줘서, 화면이
 * "게시 후 62시간 기준"처럼 정직하게 표기할 수 있게 한다. 이력이 목표 시점보다
 * 한참 뒤에 시작한 게시물은 초기 성과를 알 수 없으므로 0이 아니라 null이다.
 */
export function viewsAtAge(
  reel: Reel,
  history: ReelMetricSnapshot[],
  targetHours: number = AGE_TARGET_HOURS,
): AgeNormalizedViews | null {
  const candidates = history
    .filter((row) => row.reelId === reel.id)
    .map((row) => ({ row, hours: elapsedHours(reel.postedAt, row.date) }))
    .filter(({ hours }) => hours >= 0 && hours <= targetHours + AGE_SLACK_HOURS);

  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) =>
    Math.abs(b.hours - targetHours) < Math.abs(a.hours - targetHours) ? b : a,
  );

  return { views: best.row.views, elapsedHours: best.hours, date: best.row.date };
}

/**
 * 게시물별 초기 조회수 맵. 값을 구할 수 없는 게시물도 null로 키를 남긴다 —
 * 목록에서 조용히 사라지지 않고 "이력 없음"으로 표시되게 하기 위해서다.
 */
export function buildAgeNormalizedMap(
  reels: Reel[],
  history: ReelMetricSnapshot[],
  targetHours: number = AGE_TARGET_HOURS,
): Record<string, AgeNormalizedViews | null> {
  const map: Record<string, AgeNormalizedViews | null> = {};
  for (const reel of reels) {
    map[reel.id] = viewsAtAge(reel, history, targetHours);
  }
  return map;
}
