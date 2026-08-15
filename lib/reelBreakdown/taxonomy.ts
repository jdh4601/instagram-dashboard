import type { BreakdownHookType } from "@/lib/schemas/hook";

export interface BreakdownHookSpec {
  key: BreakdownHookType;
  ko: string;
  en: string;
  desc: string;
}

/** reel-breakdown 플러그인의 DEFAULT_HOOK_TAXONOMY를 그대로 옮긴 목록. */
export const BREAKDOWN_HOOK_TAXONOMY: BreakdownHookSpec[] = [
  { key: "negation", ko: "부정 선언형", en: "The Negation", desc: '"다들 X라고 생각하지만, 아니다."' },
  { key: "number", ko: "숫자 충격형", en: "The Shock Number", desc: "충격적인 수치를 먼저 던진다." },
  { key: "secret", ko: "은폐 폭로형", en: "The Quiet Move", desc: '"아무도 말 안 하지만", "조용히" 같은 은폐 프레이밍.' },
  { key: "rank", ko: "서열 리스트형", en: "The Ranked List", desc: "번호를 매긴 목록으로 예고한다." },
  { key: "mindread", ko: "독심술형", en: "The Mind-Read", desc: '"맞혀볼게요, 당신은…" 시청자의 상황을 짚는다.' },
  { key: "demo", ko: "체험 시연형", en: "The Demo", desc: "화면 속 무언가를 직접 가리키며 시작한다." },
  { key: "zoomout", ko: "줌아웃 철학형", en: "The Zoom-Out", desc: "큰 관점에서 상황을 재정의하며 연다." },
  { key: "metaphor", ko: "의인화 은유형", en: "The Metaphor", desc: "추상적 개념을 비유로 치환해 연다." },
  { key: "credential", ko: "이력 제시형", en: "The Credential", desc: "화자의 경력·성과를 먼저 제시한다." },
  { key: "testimony", ko: "고객 증언형", en: "The Testimonial", desc: "제3자의 증언을 인용하며 연다." },
  { key: "warning", ko: "경고형", en: "The Warning", desc: "임박한 위험이나 손실을 경고하며 연다." },
  { key: "challenge", ko: "미션 제안형", en: "The Challenge", desc: '"N일 동안 이거 해보세요" 식 과제를 던진다.' },
  { key: "contrast", ko: "대조 비교형", en: "The Contrast", desc: "두 대상을 나란히 놓고 차이를 부각한다." },
  { key: "story", ko: "사건 몰입형", en: "The In-Scene Open", desc: "설명 없이 사건 한복판에서 시작한다." },
  { key: "declaration", ko: "스케일 선언형", en: "The Scale Declaration", desc: "아직 밝히지 않은 결과물의 규모·영향을 먼저 선언한다." },
  { key: "confession", ko: "자기고백형", en: "The Confession", desc: "화자가 자신의 약점·실수·과거 실패를 먼저 고백하며 연다." },
];

export const BREAKDOWN_HOOK_BY_KEY = new Map(
  BREAKDOWN_HOOK_TAXONOMY.map((spec) => [spec.key, spec] as const),
);

export function taxonomyForPrompt(): string {
  return BREAKDOWN_HOOK_TAXONOMY.map(
    (spec) => `- ${spec.key}: ${spec.ko} (${spec.en}) — ${spec.desc}`,
  ).join("\n");
}
