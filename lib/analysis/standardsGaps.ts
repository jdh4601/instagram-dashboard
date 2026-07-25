import type { MediaKind, Reel } from "@/lib/schemas";
import { diagnoseRecent, type RecentDiagnosis } from "@/lib/analysis/recentDiagnosis";

const KINDS: MediaKind[] = ["REELS", "CAROUSEL"];
const KIND_LABEL: Record<MediaKind, string> = { REELS: "릴스", CAROUSEL: "캐러셀" };

export interface StandardsGap {
  kind: MediaKind;
  label: string;
  diagnosis: RecentDiagnosis;
}

/**
 * 포맷별로 최근 게시물이 업계 절대 기준에 못 미치는 지표를 모은다.
 *
 * 게시물 상세는 개인 베이스라인으로 게시물 간 변별을 유지하지만, 그 기준으로는 계정
 * 전체가 낮은 지표가 드러나지 않는다(INS-10). 계정 화면의 질문은 "우리가 구조적으로
 * 뭘 못하나"이므로 절대 기준으로 진단한 diagnoseRecent의 약점만 추린다.
 */
export function buildStandardsGaps(reels: Reel[]): StandardsGap[] {
  const gaps: StandardsGap[] = [];
  for (const kind of KINDS) {
    const diagnosis = diagnoseRecent(reels, kind);
    if (diagnosis.reelCount === 0 || diagnosis.weaknesses.length === 0) continue;
    gaps.push({ kind, label: KIND_LABEL[kind], diagnosis });
  }
  return gaps;
}
