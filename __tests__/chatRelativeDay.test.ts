import { relativeDay } from "@/lib/chat/relativeDay";

const NOW = new Date(2026, 6, 31, 14, 0, 0); // 2026-07-31 14:00 (로컬)

function at(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

test("같은 날은 오늘이다", () => {
  expect(relativeDay(at(2026, 7, 31, 1), NOW)).toBe("오늘");
  expect(relativeDay(at(2026, 7, 31, 23), NOW)).toBe("오늘");
});

test("하루 전은 어제다", () => {
  expect(relativeDay(at(2026, 7, 30), NOW)).toBe("어제");
});

test("시각이 아니라 달력 날짜로 센다", () => {
  // 어젯밤 11시와 오늘 새벽 1시는 24시간이 안 되지만 하루 차이다.
  expect(relativeDay(at(2026, 7, 30, 23), new Date(2026, 6, 31, 1))).toBe("어제");
});

test("일주일 안쪽은 며칠 전으로 센다", () => {
  expect(relativeDay(at(2026, 7, 28), NOW)).toBe("3일 전");
  expect(relativeDay(at(2026, 7, 25), NOW)).toBe("6일 전");
});

test("일주일이 넘으면 월·일로 보여준다", () => {
  expect(relativeDay(at(2026, 7, 24), NOW)).toBe("7월 24일");
  expect(relativeDay(at(2026, 6, 3), NOW)).toBe("6월 3일");
});

test("읽을 수 없는 값은 빈 문자열이다", () => {
  expect(relativeDay("어제쯤", NOW)).toBe("");
});
