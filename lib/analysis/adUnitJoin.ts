import type { AdUnit } from "@/lib/ads/adUnit";
import type { Reel } from "@/lib/schemas";

/**
 * 광고를 오가닉 게시물에 잇는다.
 *
 * 잇지 못해도 광고를 버리지 않는다. 조인은 "원본 콘텐츠 성과"를 켜고 끌 뿐이고,
 * 광고 자체는 목록과 상세에 그대로 남는다.
 *
 * 두 번 맞춰 보는 이유는 실측에서 겪었다. 광고 크리에이티브의
 * effective_instagram_media_id가 우리가 동기화하는 게시물 id와 다른 값으로 오는
 * 경우가 있어서, id만 믿으면 이을 수 있는 광고까지 놓친다.
 */

/** instagram.com/p/{코드} 또는 /reel/{코드}에서 코드만 떼어 낸다. */
export function permalinkShortcode(permalink: string | undefined): string | null {
  if (!permalink) return null;
  const match = /instagram\.com\/(?:p|reel|reels|tv)\/([^/?#]+)/.exec(permalink);
  return match ? match[1] : null;
}

export function findPostForAdUnit(unit: AdUnit, reels: Reel[]): Reel | null {
  if (unit.mediaId) {
    const byId = reels.find((reel) => reel.id === unit.mediaId);
    if (byId) return byId;
  }

  const shortcode = permalinkShortcode(unit.permalink);
  if (shortcode) {
    const byPermalink = reels.find((reel) => permalinkShortcode(reel.permalink) === shortcode);
    if (byPermalink) return byPermalink;
  }

  return null;
}
