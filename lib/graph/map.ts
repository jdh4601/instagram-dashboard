import type { MediaKind, Reel } from "@/lib/schemas";

// Graph 인사이트 응답 { data: [{ name, values: [{ value }] }] } → { metric: value }
export interface GraphInsightsResponse {
  data?: Array<{
    name: string;
    values?: Array<{ value?: number }>;
    total_value?: {
      value?: number;
      breakdowns?: Array<{
        dimension_keys?: string[];
        results?: Array<{ dimension_values?: string[]; value?: number }>;
      }>;
    };
  }>;
}

type BreakdownResult = { dimension_values?: string[]; value?: number };

/**
 * follow_type breakdown. 실제 dimension_value는 FOLLOWER / NON_FOLLOWER다.
 *
 * NON_FOLLOWER에도 "follower"가 들어 있어 검사 순서가 중요하다. "unfollow"로 검사하면
 * 어느 쪽도 걸리지 않아 언팔 수가 follows를 덮어쓴다.
 */
function applyFollowType(map: Record<string, number>, metric: string, results: BreakdownResult[]) {
  for (const result of results) {
    if (typeof result.value !== "number") continue;
    const label = (result.dimension_values ?? []).join(" ").toLowerCase();
    if (metric === "follows_and_unfollows") {
      if (label.includes("non_follower")) map.unfollows = result.value;
      else if (label.includes("follower")) map.follows = result.value;
    } else if (metric === "reach") {
      if (label.includes("non_follower")) map.reach_non_follower = result.value;
      else if (label.includes("follower")) map.reach_follower = result.value;
    }
  }
}

/**
 * media_product_type breakdown → `{metric}_ad`(광고로 산 몫)와 `{metric}_organic`(나머지 면의 합).
 *
 * 오가닉을 total_value에서 빼서 구하지 않는다. reach는 면 사이의 중복을 제거해
 * total_value가 breakdown 합보다 작고(실측 13,922 < 15,228), 빼면 음수로도 갈 수 있다.
 * 광고를 한 건도 집행하지 않은 기간에는 AD 차원 자체가 없으므로 광고분은 0이다.
 */
function applyProductType(map: Record<string, number>, metric: string, results: BreakdownResult[]) {
  let ad = 0;
  let organic = 0;
  for (const result of results) {
    if (typeof result.value !== "number") continue;
    if (result.dimension_values?.[0]?.toUpperCase() === "AD") ad += result.value;
    else organic += result.value;
  }
  map[`${metric}_ad`] = ad;
  map[`${metric}_organic`] = organic;
}

export function flattenInsights(response: GraphInsightsResponse): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of response.data ?? []) {
    const value = item.values?.[0]?.value ?? item.total_value?.value;
    if (typeof value === "number") map[item.name] = value;

    for (const breakdown of item.total_value?.breakdowns ?? []) {
      const results = breakdown.results ?? [];
      // dimension_keys가 빠진 응답도 있어(구버전 follows_and_unfollows) 기본은 follow_type이다.
      if (breakdown.dimension_keys?.[0] === "media_product_type") {
        applyProductType(map, item.name, results);
      } else {
        applyFollowType(map, item.name, results);
      }
    }
  }
  return map;
}

export interface GraphMedia {
  id: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  caption?: string;
  timestamp: string;
  thumbnail_url?: string;
  permalink?: string;
}

/** 캐러셀 낱장 한 장. Graph의 children 항목을 화면이 쓰는 모양으로 좁힌 것이다. */
export interface CarouselSlide {
  id: string;
  kind: "IMAGE" | "VIDEO";
  /** 이미지 주소 또는 mp4 주소. 서명이 만료되는 CDN URL이라 저장하지 않는다. */
  url: string;
  /** 영상 낱장의 포스터. 이미지 낱장에는 없다. */
  posterUrl?: string;
}

export interface GraphChildrenResponse {
  children?: {
    data?: Array<{
      id: string;
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
    }>;
  };
}

/**
 * 캐러셀 낱장 목록. 게시된 순서를 그대로 지킨다 — 순서가 곧 전개라 섞이면 읽을 수 없다.
 *
 * media_url이 없는 낱장(저작권 음원이 걸린 영상, 만료된 항목)은 버린다. 넘겨 봐야
 * 화면에는 깨진 이미지만 남는다.
 */
export function mapCarouselChildren(json: GraphChildrenResponse): CarouselSlide[] {
  return (json.children?.data ?? [])
    .filter((child) => typeof child.media_url === "string" && child.media_url.length > 0)
    .map((child) => ({
      id: child.id,
      kind: child.media_type === "VIDEO" ? ("VIDEO" as const) : ("IMAGE" as const),
      url: child.media_url!,
      posterUrl: child.thumbnail_url,
    }));
}

// 대시보드가 다루는 두 종류만 통과시킨다. 단일 사진·단일 영상 피드 글과
// 스토리는 분석 대상이 아니라 null이다.
export function classifyMedia(media: GraphMedia): MediaKind | null {
  if (media.media_product_type === "REELS") return "REELS";
  if (media.media_type === "CAROUSEL_ALBUM") return "CAROUSEL";
  return null;
}

// API 집계 지표만 매핑. 영상 길이와 초 단위 잔존곡선은 공개 API가 제공하지 않는다.
// 캐러셀에는 영상 지표 자체가 존재하지 않아 insights에 키가 없고, optional()이
// 그대로 undefined를 돌려준다.
export function mapMediaToReel(
  media: GraphMedia,
  insights: Record<string, number>,
  kind: MediaKind,
): Reel {
  const num = (k: string) => insights[k] ?? 0;
  const optional = (k: string) => insights[k];
  const skipRate = optional("reels_skip_rate");
  return {
    id: media.id,
    mediaType: kind,
    postedAt: media.timestamp,
    durationSec: 0, // API 미제공 — 수동 입력으로 보완
    views: num("views"),
    reach: num("reach"),
    likes: num("likes"),
    comments: num("comments"),
    saves: num("saved"),
    shares: num("shares"),
    avgWatchTimeSec: num("ig_reels_avg_watch_time") / 1000, // ms → s
    totalInteractions: optional("total_interactions"),
    totalWatchTimeSec:
      optional("ig_reels_video_view_total_time") === undefined
        ? undefined
        : optional("ig_reels_video_view_total_time")! / 1000,
    replays: optional("clips_replays_count"),
    totalPlays: optional("ig_reels_aggregated_all_plays_count"),
    skipRate,
    skipRateSource: skipRate === undefined ? undefined : "API",
    hookRetention3s: skipRate === undefined ? undefined : 100 - skipRate,
    followsFromReel: optional("follows"),
    profileActivity: optional("profile_activity"),
    profileVisits: optional("profile_visits"),
    caption: media.caption,
    // 캐러셀은 thumbnail_url이 비어 있고 media_url이 첫 장 이미지를 준다.
    thumbnailUrl: media.thumbnail_url ?? media.media_url,
    permalink: media.permalink,
  };
}
