import { getAdsConnection } from "@/lib/ads";
import { AdsRequestError } from "@/lib/ads/client";
import { adLookbackRange } from "@/lib/ads/window";
import type { AdPerformance } from "@/lib/ads/map";

/**
 * Marketing API 성과를 잠깐만 들고 있는다.
 *
 * 파일로 저장하지 않는 결정은 그대로다 — 우리가 만드는 값이 아니라 외부 집계라,
 * 사본을 두면 화면과 광고 관리자가 어긋나는 순간이 생긴다. 다만 목록과 상세가
 * 각자 물으면 게시물 하나 열 때마다 계정 전체를 다시 받게 되므로, 프로세스가
 * 사는 동안만 짧게 재활용한다.
 */
export const AD_CACHE_TTL_MS = 5 * 60 * 1000;

export interface AdFetchResult {
  performance: AdPerformance[];
  /** 토큰과 광고 계정이 설정돼 있는지. 미설정과 "설정했는데 0건"은 다른 상태다. */
  configured: boolean;
  /** 사용자에게 보여도 되는 실패 문구. 토큰이 섞이지 않는다. */
  error: string | null;
}

let cached: { at: number; value: AdFetchResult } | null = null;

async function load(): Promise<AdFetchResult> {
  const connection = await getAdsConnection();
  if (!connection) return { performance: [], configured: false, error: null };

  try {
    const performance = await connection.client.listAdPerformance(
      connection.adAccountId,
      adLookbackRange(),
    );
    return { performance, configured: true, error: null };
  } catch (err) {
    // 원문에 토큰이 섞일 수 있어 클라이언트가 만든 안전한 문구만 흘린다.
    const error =
      err instanceof AdsRequestError ? err.message : "Marketing API에 연결하지 못했습니다";
    return { performance: [], configured: true, error };
  }
}

/**
 * 광고 성과를 가져온다. `force`는 캐시를 건너뛴다 — 동기화가 쓰는 길이다.
 *
 * 실패는 캐시하지 않는다. 잠깐의 네트워크 오류가 TTL 내내 화면에 남으면,
 * 다시 눌러도 낫지 않는 고장처럼 보인다.
 */
export async function fetchAdPerformance(opts: { force?: boolean } = {}): Promise<AdFetchResult> {
  const now = Date.now();
  if (!opts.force && cached && now - cached.at < AD_CACHE_TTL_MS) return cached.value;

  const value = await load();
  if (value.error === null) cached = { at: now, value };
  else cached = null;
  return value;
}
