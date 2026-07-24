import { flattenInsights, type GraphMedia, type GraphInsightsResponse } from "@/lib/graph/map";

const DEFAULT_BASE = "https://graph.instagram.com";
const VERSION = "v23.0";

// listReels 페이지네이션 상한: 한 번의 동기화가 무한정 페이지를 따라가지 않도록 제한한다.
const MEDIA_PAGE_SIZE = "100";
const MAX_MEDIA_PAGES = 20;

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

interface MediaPage {
  data?: GraphMedia[];
  paging?: { next?: string };
}

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

  function safeGraphMessage(message: string): string {
    if (!opts.accessToken) return message;
    return message
      .replaceAll(opts.accessToken, "[REDACTED]")
      .replaceAll(encodeURIComponent(opts.accessToken), "[REDACTED]");
  }

  async function request(path: string, params: Record<string, string>): Promise<unknown> {
    // 주의: Graph API 규약대로 access_token을 쿼리스트링에 싣는다. 즉 이 URL은
    // 장기 토큰을 포함하므로, 요청 URL 전체를 그대로 로깅하는 코드는 절대 추가하지 말 것.
    const query = new URLSearchParams({ ...params, access_token: opts.accessToken });
    const url = `${base}/${VERSION}/${path}?${query.toString()}`;
    const res = await fetchImpl(url);
    const json: unknown = await res.json();
    if (!res.ok) {
      const message =
        (json as { error?: { message?: string } })?.error?.message ?? `Graph API 오류 (${path})`;
      throw new Error(safeGraphMessage(message));
    }
    return json;
  }

  // paging.next는 Graph가 발급한 완전한 URL(토큰 포함)이라 그대로 GET한다.
  // request()와 마찬가지로 이 URL 전체를 로깅하는 코드는 절대 추가하지 말 것.
  async function fetchMediaPage(nextUrl: string): Promise<MediaPage> {
    let res: FetchResult;
    try {
      res = await fetchImpl(nextUrl);
    } catch {
      // 네트워크 구현체가 토큰 포함 URL을 오류 문자열에 넣을 수 있으므로 원문을 전파하지 않는다.
      throw new Error("Graph API 페이지 요청에 실패했습니다");
    }
    const json: unknown = await res.json();
    if (!res.ok) {
      const message =
        (json as { error?: { message?: string } })?.error?.message ??
        "Graph API 오류 (me/media 페이징)";
      throw new Error(safeGraphMessage(message));
    }
    return json as MediaPage;
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
      let page = (await request("me/media", {
        fields: "id,media_type,media_product_type,caption,timestamp,thumbnail_url,permalink",
        limit: MEDIA_PAGE_SIZE,
      })) as MediaPage;
      const reels: GraphMedia[] = [];
      const seenPages = new Set<string>();
      for (let pageCount = 0; pageCount < MAX_MEDIA_PAGES; pageCount++) {
        for (const media of page.data ?? []) {
          if (media.media_product_type === "REELS") reels.push(media);
        }
        const next = page.paging?.next;
        if (!next) return reels;
        // 일부만 반환하면 진단 표본이 조용히 잘리므로 안전 상한에서는 명시적으로 실패한다.
        if (pageCount + 1 >= MAX_MEDIA_PAGES) {
          throw new Error(`Graph API 미디어 페이지가 안전 상한(${MAX_MEDIA_PAGES})을 초과했습니다`);
        }
        if (seenPages.has(next)) {
          throw new Error("Graph API 미디어 페이지 커서가 반복되었습니다");
        }
        seenPages.add(next);
        page = await fetchMediaPage(next);
      }
      return reels;
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
