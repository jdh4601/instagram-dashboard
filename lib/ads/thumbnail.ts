import type { AdUnit } from "@/lib/ads/adUnit";

/**
 * 광고 썸네일을 인스타그램에서 받아 갈아 끼운다.
 *
 * Meta가 크리에이티브 썸네일로 페이지 프로필 이미지를 주는 경우가 있어서(실측),
 * 그것만 믿으면 목록에 어느 릴스인지 알 수 없는 로고가 줄줄이 걸린다. 광고가
 * 가리키는 게시물 id를 인스타그램에 직접 물으면 실제 첫 장면이 온다.
 *
 * 실패는 삼킨다. 썸네일은 곁가지라, 이것 때문에 광고 목록 전체가 못 뜨면 안 된다.
 */
export type FetchMediaThumbnail = (mediaId: string) => Promise<string | null>;

export async function resolveAdUnitThumbnails(
  units: AdUnit[],
  fetchThumbnail: FetchMediaThumbnail,
): Promise<AdUnit[]> {
  // 한 게시물을 여러 번 태우면 광고마다 같은 미디어를 가리킨다. 광고 수만큼 물으면
  // 목록 한 번 여는 데 요청이 배로 늘어난다.
  const mediaIds = [...new Set(units.map((unit) => unit.mediaId).filter((id) => id !== undefined))];

  const resolved = new Map<string, string>();
  await Promise.all(
    mediaIds.map(async (mediaId) => {
      try {
        const url = await fetchThumbnail(mediaId);
        if (url) resolved.set(mediaId, url);
      } catch {
        // 토큰 만료나 지워진 미디어. Meta가 준 이미지로 물러난다.
      }
    }),
  );

  return units.map((unit) => {
    const url = unit.mediaId ? resolved.get(unit.mediaId) : undefined;
    return url ? { ...unit, thumbnailUrl: url } : unit;
  });
}
