import type { MediaKind, Reel } from "@/lib/schemas";

// Graph 인사이트 응답 { data: [{ name, values: [{ value }] }] } → { metric: value }
export interface GraphInsightsResponse {
  data?: Array<{
    name: string;
    values?: Array<{ value?: number }>;
    total_value?: {
      value?: number;
      breakdowns?: Array<{
        results?: Array<{ dimension_values?: string[]; value?: number }>;
      }>;
    };
  }>;
}

export function flattenInsights(response: GraphInsightsResponse): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of response.data ?? []) {
    const value = item.values?.[0]?.value ?? item.total_value?.value;
    if (typeof value === "number") map[item.name] = value;

    for (const breakdown of item.total_value?.breakdowns ?? []) {
      for (const result of breakdown.results ?? []) {
        if (typeof result.value !== "number") continue;
        const label = (result.dimension_values ?? []).join(" ").toLowerCase();
        if (item.name === "follows_and_unfollows") {
          if (label.includes("unfollow")) map.unfollows = result.value;
          else if (label.includes("follow")) map.follows = result.value;
        } else if (item.name === "reach") {
          // follow_type breakdown. NON_FOLLOWER에도 "follower"가 들어 있어 순서가 중요하다.
          if (label.includes("non_follower")) map.reach_non_follower = result.value;
          else if (label.includes("follower")) map.reach_follower = result.value;
        }
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
