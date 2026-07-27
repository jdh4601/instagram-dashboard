import { classifyMedia, flattenInsights, type GraphMedia, type GraphInsightsResponse } from "@/lib/graph/map";
import type { MediaKind } from "@/lib/schemas";

const DEFAULT_BASE = "https://graph.instagram.com";
const VERSION = "v23.0";

// listMedia 페이지네이션 상한: 한 번의 동기화가 무한정 페이지를 따라가지 않도록 제한한다.
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

// 캐러셀에는 ig_reels_*, reels_skip_rate, clips_replays_count가 존재하지 않는다.
// 함께 요청하면 optionalInsights의 폴백이 지표를 하나씩 재요청해 게시물당
// 불필요한 Graph 호출이 여러 번 발생한다.
const REQUIRED_CAROUSEL_METRICS = ["reach", "likes", "comments", "saved", "shares"];

const OPTIONAL_CAROUSEL_METRICS = [
  "views",
  "total_interactions",
  "follows",
  "profile_visits",
  "profile_activity",
];

const METRICS_BY_KIND: Record<MediaKind, { required: string[]; optional: string[] }> = {
  REELS: { required: REQUIRED_REEL_METRICS, optional: OPTIONAL_REEL_METRICS },
  CAROUSEL: { required: REQUIRED_CAROUSEL_METRICS, optional: OPTIONAL_CAROUSEL_METRICS },
};

// follows_and_unfollows는 여기 없다 — breakdown=follow_type 없이 요청하면 Graph가
// total_value 없는 껍데기를 돌려줘 영구히 "미지원"으로 잡힌다. followTypeInsights가 맡는다.
const ACCOUNT_METRICS = [
  "views",
  "reach",
  "accounts_engaged",
  "total_interactions",
  "profile_views",
  // 바이오 링크 클릭. profile_links_taps와 다르다 — 그쪽은 연락처 버튼(주소·통화·
  // 이메일·텍스트) 집계라 링크인바이오 성과로 읽으면 안 된다.
  "website_clicks",
  "profile_links_taps",
];

// follow_type breakdown을 공유하는 계정 지표. 한 호출에 함께 실어 보낸다.
const FOLLOW_TYPE_METRICS = ["reach", "follows_and_unfollows"];

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

export interface MediaListing {
  /** 분석 대상으로 분류된 미디어(릴스·캐러셀) */
  analyzable: GraphMedia[];
  /**
   * 분류 성공 여부와 무관하게 응답에 존재한 모든 미디어 id.
   * 분류 실패를 "삭제됨"으로 오인해 지우지 않도록 prune은 이 집합에 대조한다.
   */
  allIds: string[];
}

export interface GraphClient {
  getProfile(): Promise<GraphProfile>;
  listMedia(): Promise<MediaListing>;
  getInsights(mediaId: string, kind?: MediaKind): Promise<GraphInsightResult>;
  getAccountInsights?(range: { since: string; until: string }): Promise<GraphInsightResult>;
}

export function createGraphClient(opts: Options): GraphClient {
  const base = opts.baseURL ?? DEFAULT_BASE;
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((url) => fetch(url) as unknown as Promise<FetchResult>);
  const optionalCapabilities = new Map<MediaKind, { supported: string[]; unavailable: string[] }>();

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

  // follow_type breakdown 묶음. 성공하면 reach_follower/reach_non_follower와
  // follows/unfollows를, 실패하면(미지원이거나 일시 오류) 해당 지표를 unavailable로
  // 표시한다. 이 지표가 없어도 나머지 계정 동기화는 멈추지 않아야 한다.
  async function followTypeInsights(
    window: Record<string, string>,
  ): Promise<GraphInsightResult> {
    const failed: GraphInsightResult = {
      metrics: {},
      availableMetrics: [],
      unavailableMetrics: ["reach_follow_type", "follows_and_unfollows"],
    };
    try {
      const json = (await request("me/insights", {
        ...window,
        metric: FOLLOW_TYPE_METRICS.join(","),
        breakdown: "follow_type",
      })) as GraphInsightsResponse;
      const values = flattenInsights(json);
      const reachOk = "reach_follower" in values || "reach_non_follower" in values;
      const followsOk = "follows" in values || "unfollows" in values;
      const available: string[] = [];
      const unavailable: string[] = [];
      (reachOk ? available : unavailable).push("reach_follow_type");
      (followsOk ? available : unavailable).push("follows_and_unfollows");
      return { metrics: values, availableMetrics: available, unavailableMetrics: unavailable };
    } catch (err) {
      console.warn(
        `[graph] follow_type breakdown 실패 — 팔로워/비팔로워 도달과 팔로우·언팔로우를 건너뜁니다: ` +
          safeGraphMessage(err instanceof Error ? err.message : String(err)),
      );
      return failed;
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

    async listMedia() {
      let page = (await request("me/media", {
        fields: "id,media_type,media_product_type,caption,timestamp,thumbnail_url,media_url,permalink",
        limit: MEDIA_PAGE_SIZE,
      })) as MediaPage;
      const analyzable: GraphMedia[] = [];
      const allIds: string[] = [];
      const seenPages = new Set<string>();
      for (let pageCount = 0; pageCount < MAX_MEDIA_PAGES; pageCount++) {
        for (const media of page.data ?? []) {
          allIds.push(media.id);
          if (classifyMedia(media) !== null) analyzable.push(media);
        }
        const next = page.paging?.next;
        if (!next) return { analyzable, allIds };
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
      return { analyzable, allIds };
    },

    async getInsights(mediaId, kind = "REELS") {
      const { required: requiredMetrics, optional: optionalMetrics } = METRICS_BY_KIND[kind];
      const json = (await request(`${mediaId}/insights`, {
        metric: requiredMetrics.join(","),
      })) as GraphInsightsResponse;
      const required = flattenInsights(json);
      const cached = optionalCapabilities.get(kind);
      const metricsToRequest = cached?.supported ?? optionalMetrics;
      const optional = await optionalInsights(`${mediaId}/insights`, metricsToRequest);
      if (!cached) {
        optionalCapabilities.set(kind, {
          supported: optional.availableMetrics,
          unavailable: optional.unavailableMetrics,
        });
      }
      return {
        metrics: { ...required, ...optional.metrics },
        availableMetrics: [
          ...requiredMetrics.filter((metric) => metric in required),
          ...optional.availableMetrics,
        ],
        unavailableMetrics: [
          ...(optionalCapabilities.get(kind)?.unavailable ?? []),
          ...optional.unavailableMetrics,
        ].filter((metric, index, values) => values.indexOf(metric) === index),
      };
    },

    async getAccountInsights(range) {
      const window = {
        period: "day",
        metric_type: "total_value",
        since: range.since,
        until: range.until,
      };
      // breakdown 있이/없이는 한 호출에 담을 수 없어(Graph 규약) 따로 요청한다.
      // 계정 지표와 반드시 같은 기간을 써야 화면에서 두 창의 숫자가 섞이지 않는다(INS-1).
      const [base, followType] = await Promise.all([
        optionalInsights("me/insights", ACCOUNT_METRICS, window),
        followTypeInsights(window),
      ]);
      return {
        // followType의 reach는 breakdown 합(추산)이라 base의 정식 reach를 덮지 않게 뒤로 병합하지 않는다.
        metrics: { ...followType.metrics, ...base.metrics },
        availableMetrics: [...base.availableMetrics, ...followType.availableMetrics],
        unavailableMetrics: [...base.unavailableMetrics, ...followType.unavailableMetrics],
      };
    },
  };
}
