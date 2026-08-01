import { ApplicationSchema, type Application } from "@/lib/schemas";

/** Walla 폼의 필드 정의(GET /forms/{formId}/fields). */
export interface WallaField {
  fieldId: string;
  label: string;
}

/**
 * 응답 한 행(GET /forms/{formId}/responses).
 *
 * 숨김 필드는 `hidden-{fieldId}` 키로, 일반 응답은 필드 ID 키로 섞여 온다.
 * 폼마다 키가 달라 인덱스 시그니처로 받은 뒤 매핑으로 좁힌다.
 */
export interface WallaResponseRow {
  responseId: string;
  submittedAt: string;
  [key: string]: unknown;
}

/** 대시보드가 추적하는 UTM 축. */
export type UtmKey = "source" | "medium" | "campaign" | "content";

/**
 * 숨김 필드 라벨의 표기 흔들림을 흡수하기 위한 별칭.
 *
 * 라벨은 사용자가 Walla 설정에서 손으로 입력한 자유 문자열이다. utm_ 접두사를 빼거나
 * 한글로 적는 일이 흔해서, 정확히 일치하는 라벨만 인정하면 링크는 제대로 붙였는데
 * 대시보드에서만 출처 미상으로 보이는 사고가 난다.
 */
const LABEL_ALIASES: Record<UtmKey, readonly string[]> = {
  source: ["utmsource", "source", "유입경로", "유입출처", "출처"],
  medium: ["utmmedium", "medium", "매체", "유입매체"],
  campaign: ["utmcampaign", "campaign", "캠페인"],
  content: ["utmcontent", "content", "콘텐츠", "소재", "크리에이티브"],
};

const UTM_KEYS = Object.keys(LABEL_ALIASES) as UtmKey[];

/** 라벨 비교용 정규화: 대소문자·공백·구분자를 지운다. */
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[\s_\-.]/g, "");
}

function resolveUtmKey(label: string): UtmKey | null {
  const normalized = normalizeLabel(label);
  return UTM_KEYS.find((key) => LABEL_ALIASES[key].includes(normalized)) ?? null;
}

/**
 * 응답 행의 숨김 필드 키(`hidden-{fieldId}`) → 정규 UTM 키 매핑.
 *
 * UTM으로 해석되지 않는 필드는 넣지 않는다. 매핑에 없는 키는 toApplication이
 * 통째로 무시하므로, 신청자 개인정보가 저장 단계로 흘러가지 않는 경계가 여기다.
 */
export function buildHiddenFieldMap(fields: WallaField[]): Map<string, UtmKey> {
  const map = new Map<string, UtmKey>();
  const claimed = new Set<UtmKey>();

  for (const field of fields) {
    const key = resolveUtmKey(field.label);
    // 같은 뜻의 필드가 둘 이상이면 먼저 정의된 쪽만 쓴다. 뒤엣것이 조용히
    // 덮어쓰면 어느 링크가 반영된 값인지 사후에 설명할 수 없다.
    if (key === null || claimed.has(key)) continue;
    claimed.add(key);
    map.set(`hidden-${field.fieldId}`, key);
  }

  return map;
}

/** 문자열 값만 UTM으로 받는다. 공백뿐인 값은 없는 것으로 다룬다. */
function utmValue(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  // 링크를 손으로 만들면 Instagram/instagram이 섞여 집계가 둘로 쪼개진다.
  return trimmed ? trimmed.toLowerCase() : undefined;
}

/**
 * Walla 응답 행 → Application.
 *
 * UTM이 하나도 없는 신청도 버리지 않는다. 링크를 직접 입력했거나 UTM을 붙이기
 * 전에 들어온 신청이 있어서, 제외하면 총 신청 수가 실제와 어긋난다.
 */
export function toApplication(
  row: WallaResponseRow,
  hiddenFields: Map<string, UtmKey>,
): Application {
  const utm: Partial<Record<UtmKey, string>> = {};

  for (const [rowKey, utmKey] of hiddenFields) {
    const value = utmValue(row[rowKey]);
    if (value !== undefined) utm[utmKey] = value;
  }

  return ApplicationSchema.parse({
    responseId: row.responseId,
    submittedAt: row.submittedAt,
    ...utm,
  });
}
