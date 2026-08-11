/**
 * `<video>`가 탐색(seek)하려면 서버가 Range 요청에 206으로 답해야 한다. 브라우저는
 * 파일 중간부터 달라고 요청하고, 전체를 200으로 돌려주면 타임라인을 끌어도 처음부터
 * 다시 받는다.
 */

export interface ByteRange {
  /** 첫 바이트 위치(포함) */
  start: number;
  /** 마지막 바이트 위치(포함). HTTP Range는 양 끝을 포함한다. */
  end: number;
}

export type RangeParseResult =
  | { kind: "none" } // 범위 요청이 아니거나 해석 불가 → 200으로 전체 전송
  | { kind: "range"; range: ByteRange }
  | { kind: "unsatisfiable" }; // 416 + Content-Range: bytes */size

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

function suffixRange(suffixLength: number, size: number): RangeParseResult {
  if (suffixLength === 0) return { kind: "unsatisfiable" };
  const start = Math.max(0, size - suffixLength);
  return { kind: "range", range: { start, end: size - 1 } };
}

/**
 * Range 헤더를 파일 크기에 맞춰 실제 바이트 구간으로 좁힌다.
 *
 * 다중 범위(`bytes=0-99,200-299`)는 multipart/byteranges 응답을 요구하는데, 영상
 * 재생에는 브라우저가 쓰지 않는다. 해석하지 않고 전체 전송으로 되돌린다.
 */
export function parseByteRange(header: string | null, size: number): RangeParseResult {
  if (!header) return { kind: "none" };
  const match = SINGLE_RANGE.exec(header.trim());
  if (!match) return { kind: "none" };

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return { kind: "none" };
  if (size === 0) return { kind: "unsatisfiable" };

  if (rawStart === "") return suffixRange(Number(rawEnd), size);

  const start = Number(rawStart);
  if (start >= size) return { kind: "unsatisfiable" };

  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (end < start) return { kind: "unsatisfiable" };
  return { kind: "range", range: { start, end } };
}
