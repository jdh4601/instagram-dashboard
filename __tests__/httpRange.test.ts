import { parseByteRange } from "@/lib/media/httpRange";

test("Range 헤더가 없으면 전체를 보낸다", () => {
  expect(parseByteRange(null, 1000)).toEqual({ kind: "none" });
});

test("시작만 있는 열린 범위는 파일 끝까지로 닫는다", () => {
  expect(parseByteRange("bytes=0-", 1000)).toEqual({
    kind: "range",
    range: { start: 0, end: 999 },
  });
});

test("시작과 끝이 모두 있는 범위를 그대로 읽는다", () => {
  expect(parseByteRange("bytes=100-199", 1000)).toEqual({
    kind: "range",
    range: { start: 100, end: 199 },
  });
});

test("끝이 파일 크기를 넘으면 마지막 바이트로 잘라낸다", () => {
  expect(parseByteRange("bytes=900-5000", 1000)).toEqual({
    kind: "range",
    range: { start: 900, end: 999 },
  });
});

test("접미 범위(bytes=-N)는 마지막 N바이트를 가리킨다", () => {
  expect(parseByteRange("bytes=-300", 1000)).toEqual({
    kind: "range",
    range: { start: 700, end: 999 },
  });
});

test("접미 범위가 파일보다 크면 파일 전체를 가리킨다", () => {
  expect(parseByteRange("bytes=-5000", 1000)).toEqual({
    kind: "range",
    range: { start: 0, end: 999 },
  });
});

test("파일 크기를 벗어난 시작점은 416으로 응답해야 할 unsatisfiable이다", () => {
  expect(parseByteRange("bytes=1000-", 1000)).toEqual({ kind: "unsatisfiable" });
  expect(parseByteRange("bytes=2000-3000", 1000)).toEqual({ kind: "unsatisfiable" });
});

test("시작이 끝보다 뒤면 unsatisfiable이다", () => {
  expect(parseByteRange("bytes=500-100", 1000)).toEqual({ kind: "unsatisfiable" });
});

test("빈 파일에는 어떤 범위도 만족시킬 수 없다", () => {
  expect(parseByteRange("bytes=0-", 0)).toEqual({ kind: "unsatisfiable" });
});

test("bytes 이외의 단위나 형식이 깨진 헤더는 전체 응답으로 되돌린다", () => {
  expect(parseByteRange("items=0-10", 1000)).toEqual({ kind: "none" });
  expect(parseByteRange("bytes=abc", 1000)).toEqual({ kind: "none" });
  expect(parseByteRange("bytes=-", 1000)).toEqual({ kind: "none" });
  expect(parseByteRange("", 1000)).toEqual({ kind: "none" });
});

test("다중 범위 요청은 지원하지 않고 전체를 보낸다", () => {
  expect(parseByteRange("bytes=0-99,200-299", 1000)).toEqual({ kind: "none" });
});
