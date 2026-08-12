/**
 * 밀리초 단위 시간 상수.
 *
 * 같은 `24 * 60 * 60 * 1000`을 파일마다 다시 적으면 한 곳에서 자릿수를 틀려도
 * 아무도 눈치채지 못한다. 도메인에 매이지 않는 값이라 lib 최상위에 둔다.
 */
export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
