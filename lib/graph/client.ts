import { flattenInsights, type GraphMedia, type GraphInsightsResponse } from "@/lib/graph/map";

const DEFAULT_BASE = "https://graph.instagram.com";
const VERSION = "v23.0";

const REQUIRED_REEL_METRICS = [
  "views",
  "reach",
  "likes",
  "comments",
  "saved",
  "shares",
];

const OPTIONAL_REEL_METRICS = [
  "follows",
  "profile_activity",
  "profile_visits",
  "total_interactions",
  "ig_reels_avg_watch_time",
  "ig_reels_video_view_total_time",
  "reels_skip_rate",
  "clips_replays_count",
  "ig_reels_aggregated_all_plays_count",
];

const ACCOUNT_METRICS = [
  "views",
  "reach",
  "accounts_engaged",
  "total_interactions",
  "follows_and_unfollows",
  "profile_links_taps",
];

export interface GraphInsightResult {
  metrics: Record<string, number>;
  availableMetrics: string[];
  unavailableMetrics: string[];
}

export interface GraphProfile {
  userId: string;
  username: string;
  followersCount: number;
  avatarUrl?: string;
  mediaCount: number;
}

interface FetchResult {
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
type FetchLike = (url: string) => Promise<FetchResult>;

interface Options {
  accessToken: string;
  baseURL?: string;
  fetchImpl?: FetchLike;
}

export interface GraphClient {
  getProfile(): Promise<GraphProfile>;
  listReels(): Promise<GraphMedia[]>;
  getInsights(mediaId: string): Promise<GraphInsightResult>;
  getAccountInsights?(range: { since: string; until: string }): Promise<GraphInsightResult>;
}

export function createGraphClient(opts: Options): GraphClient {
  const base = opts.baseURL ?? DEFAULT_BASE;
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((url) => fetch(url) as unknown as Promise<FetchResult>);
  let reelOptionalCapabilities: { supported: string[]; unavailable: string[] } | null = null;

  async function request(path: string, params: Record<string, string>): Promise<unknown> {
    const query = new URLSearchParams({ ...params, access_token: opts.accessToken });
    const url = `${base}/${VERSION}/${path}?${query.toString()}`;
    const res = await fetchImpl(url);
    const json: unknown = await res.json();
    if (!res.ok) {
      const message =
        (json as { error?: { message?: string } })?.error?.message ?? `Graph API 오류 (${path})`;
      throw new Error(message);
    }
    return json;
  }

  async function optionalInsights(
    path: string,
    metrics: string[],
    params: Record<string, string> = {},
  ): Promise<GraphInsightResult> {
    if (metrics.length === 0) {
      return { metrics: {}, availableMetrics: [], unavailableMetrics: [] };
    }
    const hasMetric = (values: Record<string, number>, metric: string) =>
      metric in values ||
      (metric === "follows_and_unfollows" && ("follows" in values || "unfollows" in values));
    try {
      const json = (await request(path, { ...params, metric: metrics.join(",") })) as GraphInsightsResponse;
      const values = flattenInsights(json);
      return {
        metrics: values,
        availableMetrics: metrics.filter((metric) => hasMetric(values, metric)),
        unavailableMetrics: metrics.filter((metric) => !hasMetric(values, metric)),
      };
    } catch {
      const attempts = await Promise.all(
        metrics.map(async (metric) => {
          try {
            const json = (await request(path, { ...params, metric })) as GraphInsightsResponse;
            return { metric, values: flattenInsights(json) };
          } catch {
            return { metric, values: null };
          }
        }),
      );
      const values: Record<string, number> = {};
      const availableMetrics: string[] = [];
      const unavailableMetrics: string[] = [];
      for (const attempt of attempts) {
        if (attempt.values && hasMetric(attempt.values, attempt.metric)) {
          Object.assign(values, attempt.values);
          availableMetrics.push(attempt.metric);
        } else {
          unavailableMetrics.push(attempt.metric);
        }
      }
      return { metrics: values, availableMetrics, unavailableMetrics };
    }
  }

  return {
    async getProfile() {
      const json = (await request("me", {
        fields: "user_id,username,followers_count,profile_picture_url,media_count",
      })) as {
        user_id: string;
        username: string;
        followers_count?: number;
        profile_picture_url?: string;
        media_count?: number;
      };
      return {
        userId: json.user_id,
        username: json.username,
        followersCount: json.followers_count ?? 0,
        avatarUrl: json.profile_picture_url,
        mediaCount: json.media_count ?? 0,
      };
    },

    async listReels() {
      const json = (await request("me/media", {
        fields: "id,media_type,media_product_type,caption,timestamp,thumbnail_url,permalink",
      })) as { data?: GraphMedia[] };
      return (json.data ?? []).filter((m) => m.media_product_type === "REELS");
    },

    async getInsights(mediaId) {
      const json = (await request(`${mediaId}/insights`, {
        metric: REQUIRED_REEL_METRICS.join(","),
      })) as GraphInsightsResponse;
      const required = flattenInsights(json);
      const metricsToRequest = reelOptionalCapabilities?.supported ?? OPTIONAL_REEL_METRICS;
      const optional = await optionalInsights(`${mediaId}/insights`, metricsToRequest);
      if (reelOptionalCapabilities === null) {
        reelOptionalCapabilities = {
          supported: optional.availableMetrics,
          unavailable: optional.unavailableMetrics,
        };
      }
      return {
        metrics: { ...required, ...optional.metrics },
        availableMetrics: [
          ...REQUIRED_REEL_METRICS.filter((metric) => metric in required),
          ...optional.availableMetrics,
        ],
        unavailableMetrics: [
          ...(reelOptionalCapabilities?.unavailable ?? []),
          ...optional.unavailableMetrics,
        ].filter((metric, index, values) => values.indexOf(metric) === index),
      };
    },

    async getAccountInsights(range) {
      return optionalInsights("me/insights", ACCOUNT_METRICS, {
        period: "day",
        metric_type: "total_value",
        since: range.since,
        until: range.until,
      });
    },
  };
}
