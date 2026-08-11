/**
 * 대화 목록에 붙는 날짜 표기. 시:분까지 보여줄 이유가 없고, "3일 전"처럼
 * 대략의 거리만 알면 찾던 대화를 고를 수 있다. 일주일이 넘으면 날짜가 더 정확한
 * 단서라 월·일로 바꾼다.
 */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const days = daysBetween(then, now);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return `${then.getMonth() + 1}월 ${then.getDate()}일`;
}

/** 시각이 아니라 달력 날짜 기준으로 센다. 밤 11시와 새벽 1시는 "1일 전"이다. */
function daysBetween(then: Date, now: Date): number {
  const startOf = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((startOf(now) - startOf(then)) / 86_400_000);
}
