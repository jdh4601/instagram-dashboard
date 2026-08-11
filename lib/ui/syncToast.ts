import type { SyncToast } from "@/components/DashboardToast";
import type { SyncResult } from "@/lib/graph/sync";

/**
 * NDJSON 스트림으로 도착한 동기화 결과.
 *
 * 스트림은 헤더를 먼저 보내 상태 코드로 실패를 알릴 수 없고, 본문도 중간에 끊길 수
 * 있다. 필드가 있다고 가정하지 않고 값마다 런타임에서 좁힌다.
 */
export type SyncResultLike = Partial<Record<keyof SyncResult, unknown>>;

/** 토스트 한 줄을 넘기지 않도록 문구에 싣는 오류 건수의 상한. */
const MAX_SHOWN_ERRORS = 2;

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function messages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
}

function summarize(errors: string[]): string {
  return errors.slice(0, MAX_SHOWN_ERRORS).join(" / ");
}

/** 성공적으로 끝난 부분 — 실패가 섞여도 사용자는 무엇이 갱신됐는지 알아야 한다. */
function successBody(result: SyncResultLike): string {
  const username = typeof result.username === "string" ? result.username : "";
  const removed = count(result.removedReels);
  const unsupported = messages(result.unavailableMetrics).length;

  return (
    `동기화 완료: 게시물 ${count(result.syncedReels)}개 · @${username}` +
    (removed > 0 ? ` · 삭제된 게시물 ${removed}개 정리` : "") +
    (unsupported > 0 ? ` · 선택 지표 ${unsupported}개 미지원` : "")
  );
}

/**
 * 동기화 결과 → 사용자에게 띄울 알림.
 *
 * 성공은 3초 뒤 자동으로 사라지고 경고는 남는다(DashboardToast). 그래서 tone을 고르는
 * 일은 문구 고르기가 아니라 "이 사실을 사용자가 반드시 보게 할 것인가"의 결정이다.
 *
 * 이 로직이 페이지 컴포넌트 안에 인라인으로 있던 동안 아래 신청 폼 분기가 빠져 있었고,
 * 테스트할 이음새가 없어 오래 살아남았다. 순수 함수로 떼어 둔 이유다.
 */
export function buildSyncToast(result: SyncResultLike): SyncToast {
  const errors = messages(result.errors);
  const failed = count(result.failedReels);

  if (failed > 0) {
    return {
      tone: "warning",
      message:
        `동기화 일부 실패: 게시물 ${failed}개를 가져오지 못했습니다` +
        (errors.length > 0 ? ` — ${summarize(errors)}` : ""),
    };
  }

  // 게시물별 실패는 언제나 failedReels와 함께 쌓인다(lib/graph/sync.ts의 failed++와
  // errors.push는 같은 자리에 있다). 그러므로 여기 남은 오류는 선택 연동인 신청 폼
  // 동기화가 통째로 실패했다는 뜻이다. 이걸 성공으로 넘기면 사용자는 초록 알림만 보고
  // 신청 수가 왜 그대로인지 알 방법이 없다.
  if (errors.length > 0) {
    return { tone: "warning", message: `${successBody(result)} — 신청 폼 실패: ${summarize(errors)}` };
  }

  return { tone: "success", message: successBody(result) };
}
