import type { Reel, TranscriptLine } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { BENCHMARKS, HOOK_WINDOW_SEC } from "@/config/benchmarks";

interface TranscriptInsight {
  kind: "strength" | "weakness";
  title: string;   // 짧은 헤드라인
  detail: string;  // 지표를 곁들인 원인 분석 문장
}

export interface TranscriptAnalysis {
  lineCount: number;
  coveragePct: number | null; // 자막이 영상 길이를 덮는 비율(%). 영상 길이 미상이면 null
  lastLineSec: number;        // 마지막 자막이 끝나는 시점(초) — 길이 미상일 때 분량 표시용
  hasHookLine: boolean;       // 0~3초 안에 시작하는 자막 존재 여부
  hasCta: boolean;            // 행동 유도(팔로우/저장/공유 등) 자막 존재 여부
  insights: TranscriptInsight[];
}

// CapCut 자막에서 흔히 쓰는 한국어 CTA 표현
const CTA_KEYWORDS = [
  "팔로우", "팔로", "구독", "저장", "댓글", "공유",
  "좋아요", "알림", "프로필", "링크", "눌러", "더 보기",
];

const round1 = (n: number): string => n.toFixed(1);

// 3초 잔존률: 명시값 → skipRate 역산 순으로 사용. 둘 다 없으면 null.
function hookRetentionOf(reel: Reel): number | null {
  if (reel.hookRetention3s !== undefined) return reel.hookRetention3s;
  if (reel.skipRate !== undefined) return 100 - reel.skipRate;
  return null;
}

function hasCtaKeyword(text: string): boolean {
  return CTA_KEYWORDS.some((k) => text.includes(k));
}

function analyzeHook(
  transcript: TranscriptLine[],
  hookRet: number | null,
  out: TranscriptInsight[],
): boolean {
  const hasHookLine = transcript.some((l) => l.startSec <= HOOK_WINDOW_SEC);
  const t = BENCHMARKS.hookRetention3s;

  if (hookRet === null) return hasHookLine;

  if (hasHookLine && hookRet >= t.strongAbove) {
    out.push({
      kind: "strength",
      title: "첫 3초 자막 훅",
      detail: `시작 3초 안에 자막 훅이 있고 3초 잔존이 ${round1(hookRet)}%로 양호합니다. 도입부가 이탈을 잘 막고 있어요.`,
    });
  } else if (!hasHookLine && hookRet < t.weakBelow) {
    out.push({
      kind: "weakness",
      title: "첫 3초 자막 없음",
      detail: `시작 3초 안에 자막이 없어 시청자가 무엇을 보는지 즉시 알기 어렵습니다. 3초 잔존이 ${round1(hookRet)}%로 낮습니다 — 첫 컷에 핵심 메시지를 자막으로 띄워 보세요.`,
    });
  }
  return hasHookLine;
}

function analyzeCta(
  transcript: TranscriptLine[],
  derived: ReturnType<typeof computeDerivedRates>,
  out: TranscriptInsight[],
): boolean {
  const hasCta = transcript.some((l) => hasCtaKeyword(l.text));
  const save = derived.saveRate;
  const follow = derived.followRate;

  const strong =
    save >= BENCHMARKS.saveRate.strongAbove ||
    (follow !== undefined && follow >= BENCHMARKS.followRate.strongAbove);
  const weak =
    save < BENCHMARKS.saveRate.weakBelow ||
    (follow !== undefined && follow < BENCHMARKS.followRate.weakBelow);

  if (hasCta && strong) {
    out.push({
      kind: "strength",
      title: "CTA 자막 효과",
      detail: `행동을 유도하는 자막이 있고 저장율이 ${round1(save)}%로 높습니다. 시청자를 다음 행동으로 잘 연결했어요.`,
    });
  } else if (!hasCta && weak) {
    out.push({
      kind: "weakness",
      title: "CTA 자막 없음",
      detail: `팔로우·저장·공유를 유도하는 자막(CTA)이 없습니다. 저장율이 ${round1(save)}%로 낮아요 — 마지막 구간에 "저장해두세요" 같은 한 줄을 넣어 보세요.`,
    });
  }
  return hasCta;
}

function analyzeCoverage(
  coveragePct: number | null,
  lastEndSec: number,
  reel: Reel,
  derived: ReturnType<typeof computeDerivedRates>,
  out: TranscriptInsight[],
): void {
  // 영상 길이 미상(durationSec 0)이면 커버리지·완주율을 신뢰할 수 없으므로 판단 보류
  if (coveragePct === null) return;
  if (coveragePct >= 70) return;
  if (derived.completionRate >= BENCHMARKS.completionRate.weakBelow) return;

  out.push({
    kind: "weakness",
    title: "후반부 자막 비어있음",
    detail: `영상 ${Math.round(reel.durationSec)}초 중 자막이 ${Math.round(lastEndSec)}초까지만 있어 후반부가 비어 있습니다. 평균 시청 비율이 ${round1(derived.completionRate)}%로 낮아요 — 끝까지 자막으로 끌고 가면 시청 지속을 높일 수 있습니다.`,
  });
}

export function analyzeTranscript(reel: Reel): TranscriptAnalysis {
  const transcript = reel.transcript ?? [];

  if (transcript.length === 0) {
    return { lineCount: 0, coveragePct: null, lastLineSec: 0, hasHookLine: false, hasCta: false, insights: [] };
  }

  const derived = reel.derived ?? computeDerivedRates(reel);
  const lastEndSec = Math.max(...transcript.map((l) => l.endSec));
  // 영상 길이를 알 때만 커버리지 계산. durationSec 0(길이 미상)이면 null로 둔다.
  const coveragePct =
    reel.durationSec > 0 ? Math.min(100, (lastEndSec / reel.durationSec) * 100) : null;

  const insights: TranscriptInsight[] = [];
  const hookRet = hookRetentionOf(reel);
  const hasHookLine = analyzeHook(transcript, hookRet, insights);
  const hasCta = analyzeCta(transcript, derived, insights);
  analyzeCoverage(coveragePct, lastEndSec, reel, derived, insights);

  return { lineCount: transcript.length, coveragePct, lastLineSec: lastEndSec, hasHookLine, hasCta, insights };
}
