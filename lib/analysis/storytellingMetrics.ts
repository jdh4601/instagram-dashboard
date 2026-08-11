import type { Reel } from "@/lib/schemas";

/**
 * 자막에서 바로 잴 수 있는 객관 지표.
 *
 * 8가지 원리 중 리듬·속도·밀도는 모델의 인상이 아니라 수치로 확인할 수 있다.
 * 셀 수 있는 건 여기서 세고, 모델에게는 판단이 필요한 것만 맡긴다 — 그래야
 * "리듬이 단조롭다" 같은 지적에 근거가 붙는다.
 */

/** 문서가 말하는 훅 구간. 이 안에서 호기심이 걸리지 않으면 나머지를 못 본다. */
const HOOK_WINDOW_SEC = 3;
/** 이 이하를 짧은 문장(스타카토)으로 본다. */
const STACCATO_MAX_WORDS = 8;
/** 어절 수가 이만큼 안쪽이면 "길이가 같다"고 본다. */
const MONOTONE_TOLERANCE = 1;

export interface StorytellingMetrics {
  totalWords: number;
  lineCount: number;
  durationSec: number;
  /** 값 밀도의 대리 지표. 너무 낮으면 군더더기, 너무 높으면 흡수가 안 된다. */
  wordsPerSecond: number;
  meanWordsPerLine: number;
  /** 짧은 문장 비율 0~1. 문서는 온라인 콘텐츠가 대체로 스타카토일 때 잘 된다고 본다. */
  staccatoRatio: number;
  /** 비슷한 길이의 문장이 연달아 이어진 최장 구간. 길수록 리듬이 단조롭다. */
  longestMonotoneRun: number;
  /** 첫 3초 안에 시작한 자막 */
  hookText: string;
  hookWords: number;
  transcriptEndSec: number;
  /** 자막이 끝난 뒤 남는 시간 */
  trailingSilenceSec: number;
  /** 자막 사이의 최대 공백 */
  longestGapSec: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function longestRunOfSimilarLengths(lengths: number[]): number {
  if (lengths.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < lengths.length; i++) {
    const similar = Math.abs(lengths[i] - lengths[i - 1]) <= MONOTONE_TOLERANCE;
    current = similar ? current + 1 : 1;
    if (current > longest) longest = current;
  }
  return longest;
}

function largestGap(lines: Array<{ startSec: number; endSec: number }>): number {
  let largest = 0;
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i].startSec - lines[i - 1].endSec;
    if (gap > largest) largest = gap;
  }
  return largest;
}

export function computeStorytellingMetrics(reel: Reel): StorytellingMetrics {
  const lines = reel.transcript ?? [];
  if (lines.length === 0) {
    throw new Error("자막이 없어 구조 지표를 계산할 수 없습니다");
  }

  const ordered = [...lines].sort((a, b) => a.startSec - b.startSec);
  const lengths = ordered.map((line) => countWords(line.text));
  const totalWords = lengths.reduce((sum, count) => sum + count, 0);
  const transcriptEndSec = Math.max(...ordered.map((line) => line.endSec));

  // 길이를 모르는 릴스(durationSec 0)가 실제로 있다. 0으로 나눠 NaN을 흘리지 않는다.
  const durationSec = reel.durationSec > 0 ? reel.durationSec : 0;
  const hookLines = ordered.filter((line) => line.startSec < HOOK_WINDOW_SEC);
  const hookText = hookLines.map((line) => line.text).join(" ");

  return {
    totalWords,
    lineCount: ordered.length,
    durationSec,
    wordsPerSecond: durationSec > 0 ? round(totalWords / durationSec) : 0,
    meanWordsPerLine: round(totalWords / ordered.length, 1),
    staccatoRatio: round(
      lengths.filter((count) => count <= STACCATO_MAX_WORDS).length / lengths.length,
    ),
    longestMonotoneRun: longestRunOfSimilarLengths(lengths),
    hookText,
    hookWords: countWords(hookText),
    transcriptEndSec: round(transcriptEndSec, 1),
    trailingSilenceSec: durationSec > 0 ? round(Math.max(0, durationSec - transcriptEndSec), 1) : 0,
    longestGapSec: round(largestGap(ordered), 1),
  };
}

/** 프롬프트에 실을 요약. 모델이 인상이 아니라 수치를 근거로 삼게 한다. */
export function describeMetrics(metrics: StorytellingMetrics): string {
  return [
    `총 어절 ${metrics.totalWords}개 / 자막 ${metrics.lineCount}줄`,
    `영상 길이 ${metrics.durationSec > 0 ? `${metrics.durationSec}초` : "미상"} · 초당 ${metrics.wordsPerSecond}어절`,
    `문장 평균 ${metrics.meanWordsPerLine}어절 · 짧은 문장(8어절 이하) 비율 ${Math.round(metrics.staccatoRatio * 100)}%`,
    `비슷한 길이가 연달아 이어진 최장 구간 ${metrics.longestMonotoneRun}줄`,
    `훅 구간(0~3초) ${metrics.hookWords}어절: "${metrics.hookText}"`,
    `자막 종료 ${metrics.transcriptEndSec}초 · 끝 침묵 ${metrics.trailingSilenceSec}초 · 최대 공백 ${metrics.longestGapSec}초`,
  ].join("\n");
}
