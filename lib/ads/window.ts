/**
 * 광고 성과를 되짚는 기간.
 *
 * 계정 지표(7일)보다 길게 잡는다. 부스트는 매일 도는 것이 아니라 가끔 태우는
 * 것이라, 7일 창으로는 지난달에 태운 게시물이 표에서 통째로 사라진다. 비교표의
 * 목적이 "지금까지 태운 것들을 견주는 것"이므로 창은 넉넉해야 한다.
 */
export const AD_LOOKBACK_DAYS = 180;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Marketing API의 time_range에 그대로 넣는 YYYY-MM-DD 구간. */
export function adLookbackRange(now: Date = new Date()): { since: string; until: string } {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - AD_LOOKBACK_DAYS);
  return { since: isoDate(since), until: isoDate(now) };
}
