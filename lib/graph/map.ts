import type { Reel } from "@/lib/schemas";

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

    if (item.name === "follows_and_unfollows") {
      for (const breakdown of item.total_value?.breakdowns ?? []) {
        for (const result of breakdown.results ?? []) {
          if (typeof result.value !== "number") continue;
          const label = (result.dimension_values ?? []).join(" ").toLowerCase();
          if (label.includes("unfollow")) map.unfollows = result.value;
          else if (label.includes("follow")) map.follows = result.value;
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
  caption?: string;
  timestamp: string;
  thumbnail_url?: string;
  permalink?: string;
}

// API 집계 지표만 매핑. 영상 길이와 초 단위 잔존곡선은 공개 API가 제공하지 않는다.
export function mapMediaToReel(media: GraphMedia, insights: Record<string, number>): Reel {
  const num = (k: string) => insights[k] ?? 0;
  const optional = (k: string) => insights[k];
  const skipRate = optional("reels_skip_rate");
  return {
    id: media.id,
    postedAt: media.timestamp,
    durationSec: 0, // API 미제공 — 스샷/수동 입력으로 보완
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
    thumbnailUrl: media.thumbnail_url,
    permalink: media.permalink,
  };
}
