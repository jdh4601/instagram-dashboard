import { buildHiddenFieldMap, toApplication } from "@/lib/walla/map";
import type { WallaClient } from "@/lib/walla/client";
import type { ApplicationRepository } from "@/lib/store/applicationRepository";
import type { Application } from "@/lib/schemas";

/**
 * 한 번의 동기화가 따라갈 최대 페이지 수(페이지당 100건).
 *
 * 응답 API에 기간 필터가 없어서(page/limit/customerKey만 지원) 매번 처음부터 훑는다.
 * 폼이 오래돼 응답이 많이 쌓이면 상한 없이는 한 번의 동기화가 API를 끝없이 두드린다.
 */
export const WALLA_MAX_PAGES = 20;

export interface WallaSyncResult {
  /** 중복 제거 후 읽어 온 신청 수. */
  fetched: number;
  /** 실제로 조회한 페이지 수. */
  pages: number;
  /**
   * 상한에 걸려 멈췄는지. 참이면 더 오래된 신청이 남아 있어 총계가 과소집계다.
   * 호출자가 이 사실을 화면에 밝힐 수 있도록 결과에 남긴다.
   */
  reachedPageLimit: boolean;
}

/**
 * Walla 응답을 끌어와 신청 저장소에 반영한다.
 *
 * 웹훅이 아니라 pull인 이유: 이 대시보드는 로컬 우선이라 Walla가 호출할 공개
 * 엔드포인트가 없다. Graph 동기화와 같은 시점에 같은 방식으로 돈다.
 */
export async function syncWallaApplications(
  client: WallaClient,
  repository: ApplicationRepository,
  formId: string,
): Promise<WallaSyncResult> {
  // 숨김 필드 라벨은 폼 단위로 고정이다. 페이지마다 다시 물으면 호출만 두 배가 된다.
  const hiddenFields = buildHiddenFieldMap(await client.listFields(formId));

  // 동기화 도중 새 신청이 들어오면 페이지 경계가 밀려 같은 행이 두 페이지에 나온다.
  const byId = new Map<string, Application>();
  let pages = 0;
  let totalPages = 1;

  while (pages < totalPages && pages < WALLA_MAX_PAGES) {
    const page = await client.listResponses(formId, { page: pages + 1 });
    pages += 1;
    totalPages = page.totalPages;
    for (const row of page.responses) {
      const application = toApplication(row, hiddenFields);
      byId.set(application.responseId, application);
    }
  }

  const applications = [...byId.values()];
  if (applications.length > 0) await repository.upsertMany(applications);

  return {
    fetched: applications.length,
    pages,
    reachedPageLimit: pages >= WALLA_MAX_PAGES && pages < totalPages,
  };
}

export interface ApplicationSyncOutcome {
  /** 읽어 온 신청 수. 미연동이거나 실패면 null. */
  applications: number | null;
  reachedPageLimit: boolean;
  /** 실패 사유. 성공·미연동이면 null. */
  error: string | null;
}

/**
 * 연동돼 있으면 신청을 동기화하고, 아니면 건너뛴다. 어느 쪽이든 던지지 않는다.
 *
 * Instagram 동기화가 본 작업이다. 신청 폼은 선택 연동이라 키 만료나 Walla 장애로
 * 릴스·계정 지표 동기화까지 실패하면 손해가 훨씬 크다. 실패는 결과에 담아 올려
 * 보내고 호출자가 화면에 밝힌다.
 */
export async function syncApplicationsIfConfigured(
  connection: { client: WallaClient; formId: string } | null,
  repository: ApplicationRepository,
): Promise<ApplicationSyncOutcome> {
  if (!connection) return { applications: null, reachedPageLimit: false, error: null };

  try {
    const result = await syncWallaApplications(connection.client, repository, connection.formId);
    return {
      applications: result.fetched,
      reachedPageLimit: result.reachedPageLimit,
      error: null,
    };
  } catch (err) {
    return {
      applications: null,
      reachedPageLimit: false,
      error: err instanceof Error ? err.message : "신청 폼 동기화 실패",
    };
  }
}
