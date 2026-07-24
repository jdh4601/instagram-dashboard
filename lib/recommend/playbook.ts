import type { Diagnosis } from "@/lib/analysis/diagnosis";
import type { DropSegment } from "@/lib/analysis/dropDetection";
import type { MetricKey } from "@/config/benchmarks";

export interface Prescription {
  metric: MetricKey | "dropSegment";
  title: string;
  action: string;
  severity: "high" | "medium";
}

// 스펙 6절 계층1 — 약점 플래그 → 자동 처방 (룰 기반, 결정론)
const PLAYBOOK: Partial<Record<MetricKey, { title: string; action: string }>> = {
  hookRetention3s: {
    title: "3초 훅 강화",
    action: "도입 2~3초 컷, 가장 센 문장으로 콜드 오픈 + 궁금증 갭 생성",
  },
  shareRate: {
    title: "공유 유발",
    action: "공유를 부르는 한 줄(공감/저장각) 삽입",
  },
  commentRate: {
    title: "댓글 유도",
    action: "엔딩에 의견이 갈리는 질문 1개 배치",
  },
  followRate: {
    title: "팔로우 전환",
    action: "엔딩 3단(여운→정체성→이득형 CTA) + 다음편 떡밥 루프",
  },
  completionRate: {
    title: "완료율 개선",
    action: "급락 구간 컷 편집/속도 조절로 늘어지는 흐름 제거",
  },
  saveRate: {
    title: "저장 유발",
    action: "저장하고 싶은 정보(요약·체크리스트)를 화면에 명시",
  },
};

export function buildPlaybook(
  diagnosis: Diagnosis,
  drops: DropSegment[] = [],
): Prescription[] {
  const recs: Prescription[] = [];
  const bottleneckKey = diagnosis.bottleneck?.key;

  for (const w of diagnosis.weaknesses) {
    const entry = PLAYBOOK[w.key];
    if (!entry) continue;
    recs.push({
      metric: w.key,
      title: entry.title,
      action: entry.action,
      severity: w.key === bottleneckKey ? "high" : "medium",
    });
  }

  if (drops.length > 0) {
    const biggest = drops[0];
    recs.push({
      metric: "dropSegment",
      title: `${biggest.startSec}~${biggest.endSec}초 급락 처방`,
      action: `${Math.round(biggest.dropPct)}%p 이탈 구간 — 컷 편집/속도 조절 또는 자막 강조로 텐션 회복`,
      severity: "medium",
    });
  }

  return recs;
}
