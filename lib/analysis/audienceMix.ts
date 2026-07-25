import type { AccountSnapshot } from "@/lib/schemas";

export interface AudienceMix {
  followerReach: number;
  nonFollowerReach: number;
  /** breakdown 합계. Graph의 total_value(추산)와 조금 어긋날 수 있어 비중 분모로 이 값을 쓴다. */
  total: number;
  /** 비팔로워 비중(%). 도달이 신규 유입인지 기존 팬 반복인지 가른다. */
  nonFollowerShare: number;
  /** 값을 채택한 스냅샷 날짜 */
  date: string;
}

/**
 * 팔로워/비팔로워 도달 구성. follow_type breakdown은 계정 레벨만 지원하고 수집을
 * 시작한 시점 이후 스냅샷에만 있으므로, 두 값이 모두 있는 가장 최근 스냅샷을 쓴다.
 * 한쪽만 있거나 도달이 0인 스냅샷은 신뢰할 수 없어 건너뛴다.
 */
export function buildAudienceMix(snapshots: AccountSnapshot[]): AudienceMix | null {
  const usable = snapshots
    .filter(
      (s) =>
        s.followerReachLast7d !== undefined &&
        s.nonFollowerReachLast7d !== undefined &&
        s.followerReachLast7d + s.nonFollowerReachLast7d > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = usable.at(-1);
  if (!latest) return null;

  const followerReach = latest.followerReachLast7d!;
  const nonFollowerReach = latest.nonFollowerReachLast7d!;
  const total = followerReach + nonFollowerReach;
  return {
    followerReach,
    nonFollowerReach,
    total,
    nonFollowerShare: (nonFollowerReach / total) * 100,
    date: latest.date,
  };
}
