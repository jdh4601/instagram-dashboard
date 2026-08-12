import { syncedAgoLabel } from "@/lib/ui/syncedAgo";

const NOW = new Date("2026-08-11T14:00:00+09:00");

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

test("한 번도 동기화하지 않았으면 표시할 문구가 없다", () => {
  expect(syncedAgoLabel(null, NOW)).toBeNull();
  expect(syncedAgoLabel(undefined, NOW)).toBeNull();
});

test("읽을 수 없는 값도 표시하지 않는다", () => {
  expect(syncedAgoLabel("어제쯤", NOW)).toBeNull();
});

test("1분이 안 지났으면 방금이다", () => {
  expect(syncedAgoLabel(minutesAgo(0), NOW)).toBe("방금 동기화");
  expect(syncedAgoLabel(minutesAgo(0.5), NOW)).toBe("방금 동기화");
});

test("한 시간 안쪽은 분으로 센다", () => {
  expect(syncedAgoLabel(minutesAgo(1), NOW)).toBe("1분 전 동기화");
  expect(syncedAgoLabel(minutesAgo(59), NOW)).toBe("59분 전 동기화");
});

test("하루 안쪽은 시간으로 센다", () => {
  expect(syncedAgoLabel(minutesAgo(60), NOW)).toBe("1시간 전 동기화");
  expect(syncedAgoLabel(minutesAgo(60 * 3 + 40), NOW)).toBe("3시간 전 동기화");
  expect(syncedAgoLabel(minutesAgo(60 * 23), NOW)).toBe("23시간 전 동기화");
});

test("하루가 넘으면 일로 센다", () => {
  expect(syncedAgoLabel(minutesAgo(60 * 24), NOW)).toBe("1일 전 동기화");
  expect(syncedAgoLabel(minutesAgo(60 * 24 * 2 + 60), NOW)).toBe("2일 전 동기화");
});

test("시계가 어긋나 미래 시각이 들어와도 음수를 보여주지 않는다", () => {
  expect(syncedAgoLabel(minutesAgo(-30), NOW)).toBe("방금 동기화");
});
