import type { Reel } from "@/lib/schemas";

export const FUNNEL_WINDOW_DAYS = 7;

export interface ConversionFunnel {
  /** 창 안 게시물 수. 0이면 표시할 것이 없다. */
  postCount: number;
  /** 창 안 게시물의 도달 합계. */
  reach: number;
  /** 프로필 방문 합계. 측정된 게시물이 하나도 없으면 null. */
  profileVisits: number | null;
  /** 팔로우 합계. 측정된 게시물이 하나도 없으면 null. */
  follows: number | null;
  /** 방문 ÷ (방문이 측정된 게시물의 도달), %. */
  visitRate: number | null;
  /** 팔로우 ÷ 방문, %. */
  followRate: number | null;
  /** 방문 지표가 없는 게시물 수 — 화면에 부분 데이터임을 밝힌다. */
  postsMissingVisits: number;
  /** 팔로우 지표가 없는 게시물 수. */
  postsMissingFollows: number;
}

const EMPTY: ConversionFunnel = {
  postCount: 0,
  reach: 0,
  profileVisits: null,
  follows: null,
  visitRate: null,
  followRate: null,
  postsMissingVisits: 0,
  postsMissingFollows: 0,
};

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

/**
 * 최근 N일 게시물의 도달 → 프로필 방문 → 팔로우 퍼널.
 *
 * 계정 스냅샷의 reachLast7d(중복 제거된 고유 계정)를 쓰지 않고 게시물별 도달을
 * 합산한다. 프로필 방문·팔로우는 게시물 단위로만 수집되므로, 세 단계를 같은
 * 출처에서 뽑아야 비율이 서로 맞는다. 대신 여러 글을 본 사람은 중복 계산되므로
 * 절대값이 아니라 단계 간 전환율을 읽는 지표다.
 *
 * 누락 지표를 0으로 채우지 않는다. 채우면 전환율이 실제보다 낮게 보인다.
 */
export function buildConversionFunnel(
  reels: Reel[],
  now: Date | string = new Date(),
  windowDays: number = FUNNEL_WINDOW_DAYS,
): ConversionFunnel {
  const end = new Date(now).getTime();
  const start = end - windowDays * 86_400_000;

  const inWindow = reels.filter((reel) => {
    const posted = new Date(reel.postedAt).getTime();
    return Number.isFinite(posted) && posted >= start && posted <= end;
  });
  if (inWindow.length === 0) return EMPTY;

  let reach = 0;
  let visits = 0;
  let follows = 0;
  // 방문율의 분모는 "방문이 측정된 게시물의 도달"이다. 측정 안 된 게시물의 도달을
  // 분모에 넣으면 방문이 없는 것처럼 보인다.
  let reachWithVisits = 0;
  let postsMissingVisits = 0;
  let postsMissingFollows = 0;

  for (const reel of inWindow) {
    reach += reel.reach;

    if (typeof reel.profileVisits === "number") {
      visits += reel.profileVisits;
      reachWithVisits += reel.reach;
    } else {
      postsMissingVisits += 1;
    }

    if (typeof reel.followsFromReel === "number") follows += reel.followsFromReel;
    else postsMissingFollows += 1;
  }

  const hasVisits = postsMissingVisits < inWindow.length;
  const hasFollows = postsMissingFollows < inWindow.length;

  return {
    postCount: inWindow.length,
    reach,
    profileVisits: hasVisits ? visits : null,
    follows: hasFollows ? follows : null,
    visitRate: hasVisits ? rate(visits, reachWithVisits) : null,
    followRate: hasVisits && hasFollows ? rate(follows, visits) : null,
    postsMissingVisits,
    postsMissingFollows,
  };
}
