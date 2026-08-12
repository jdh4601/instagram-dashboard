import type { WallaField, WallaResponseRow } from "@/lib/walla/map";

const DEFAULT_BASE = "https://app.walla.my/open-api/v1";

// 응답 목록의 페이지당 상한. API 문서가 정한 최대값이다.
const MAX_LIMIT = 100;

/**
 * Walla가 오류 상태로 답했을 때 던지는 오류.
 *
 * 상태 코드를 필드로 남기는 이유: 401(키)과 404(폼 ID)는 사용자가 고쳐야 할 곳이
 * 다른데, 메시지 문자열을 정규식으로 되짚어 구분하면 문구를 다듬는 순간 조용히 깨진다.
 * 메시지 형식은 기존 계약 그대로 둬서 호출부가 영향을 받지 않는다.
 */
export class WallaRequestError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    // 본문에 키가 되비쳐 올 수 있다. 상태 코드만 남기고 본문은 버린다.
    super(`Walla 요청 실패 (${status}): ${path}`);
    this.name = "WallaRequestError";
  }
}

export interface WallaFetchResult {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<WallaFetchResult>;

interface WallaResponsePage {
  responses: WallaResponseRow[];
  totalPages: number;
}

export interface WallaClient {
  listFields(formId: string): Promise<WallaField[]>;
  listResponses(formId: string, opts: { page: number; limit?: number }): Promise<WallaResponsePage>;
}

export interface WallaClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export function createWallaClient(opts: WallaClientOptions): WallaClient {
  const base = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
  const fetchImpl: FetchLike =
    opts.fetchImpl ?? ((url, init) => fetch(url, init) as unknown as Promise<WallaFetchResult>);

  async function request(path: string): Promise<unknown> {
    const url = `${base}${path}`;
    let res: WallaFetchResult;
    try {
      res = await fetchImpl(url, { headers: { "X-WALLA-API-KEY": opts.apiKey } });
    } catch {
      // fetch 구현체가 헤더째 오류에 실을 수 있어 원문을 흘리지 않는다.
      throw new Error(`Walla 요청 실패: ${path}`);
    }
    if (!res.ok) throw new WallaRequestError(res.status, path);
    return res.json();
  }

  return {
    async listFields(formId) {
      const body = asRecord(await request(`/forms/${encodeURIComponent(formId)}/fields`));
      const data = body.data;
      // 문서에 필드 응답 스키마가 없다. 봉투 안 배열이거나 fields 키에 담긴 두 형태를
      // 모두 받아 두고, 실 계정 연결 시 실제 형태로 좁힌다.
      const rawFields = Array.isArray(data) ? data : asRecord(data).fields;
      if (!Array.isArray(rawFields)) return [];

      return rawFields.flatMap((raw) => {
        const field = asRecord(raw);
        const fieldId = firstString(field, ["fieldId", "id", "field_id"]);
        const label = firstString(field, ["label", "title", "name"]);
        // 라벨이 없으면 UTM 여부를 판정할 근거가 없다.
        if (!fieldId || !label) return [];
        return [{ fieldId, label }];
      });
    },

    async listResponses(formId, { page, limit = MAX_LIMIT }) {
      const capped = Math.min(limit, MAX_LIMIT);
      const body = asRecord(
        await request(
          `/forms/${encodeURIComponent(formId)}/responses?page=${page}&limit=${capped}`,
        ),
      );
      const data = asRecord(body.data);
      const rows = Array.isArray(data.responses) ? data.responses : [];
      const totalPages = asRecord(data.pagination).totalPages;

      return {
        responses: rows.flatMap((raw) => {
          const row = asRecord(raw);
          // responseId는 중복 제거 키다. 없으면 저장해도 다음 동기화에서 또 쌓인다.
          if (typeof row.responseId !== "string" || typeof row.submittedAt !== "string") return [];
          return [row as WallaResponseRow];
        }),
        totalPages: typeof totalPages === "number" ? totalPages : 1,
      };
    },
  };
}
