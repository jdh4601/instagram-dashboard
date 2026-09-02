import {
  classifyMedia,
  flattenInsights,
  mapCarouselChildren,
  type CarouselSlide,
  type GraphChildrenResponse,
  type GraphMedia,
  type GraphInsightsResponse,
} from "@/lib/graph/map";
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

// media_product_type breakdown을 지원하는 계정 지표. AD 차원이 곧 "광고로 산 몫"이다.
// follows·profile_views·accounts_engaged는 이 breakdown을 받지 않는다(실측 확인).
const PRODUCT_TYPE_METRICS = ["views", "reach", "total_interactions"];

// 광고/오가닉 분리가 가능한지를 나타내는 능력 이름. 지표 하나가 아니라 breakdown
// 한 벌이 통째로 되거나 안 되거나이므로 이름도 하나로 둔다.
const PRODUCT_TYPE_CAPABILITY = "media_product_type";

export interface GraphInsightResult {
  metrics: Record<string, number>;
  availableMetrics: string[];
  unavailableMetrics: string[];
}

interface GraphProfile {
  userId: string;
  username: string;
  displayName?: string;
  biography?: string;
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

interface MediaListing {
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
  /**
   * 미디어 한 건의 재생 가능한 mp4 주소. 동기화 목록에서 받은 media_url은 서명이
   * 만료되므로, 상세 화면에서 영상을 받을 때는 그때 다시 물어봐야 한다.
   * 이미지·만료된 게시물은 필드가 없어 null이다.
   */
  getMediaUrl?(mediaId: string): Promise<string | null>;
  /**
   * 미디어 한 건의 썸네일 주소. 광고 목록이 어느 릴스인지 보여 주려고 쓴다 —
   * Meta가 주는 크리에이티브 썸네일은 페이지 로고인 경우가 있어 믿을 수 없다.
   * 영상은 thumbnail_url이, 이미지는 media_url이 그 자리를 맡는다.
   */
  getMediaThumbnail?(mediaId: string): Promise<string | null>;
  /**
   * 캐러셀 낱장 목록. media_url과 마찬가지로 서명이 만료되므로 저장해 두지 않고
   * 상세 화면을 열 때마다 다시 물어본다.
   */
  getCarouselChildren?(mediaId: string): Promise<CarouselSlide[]>;
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
    let res: FetchResult;
    try {
      res = await fetchImpl(url);
    } catch {
      // fetch 구현체가 토큰이 든 URL을 원문 오류에 포함할 수 있어 일반화한다.
      throw new Error("Graph API 요청에 실패했습니다");
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`Graph API 응답을 읽지 못했습니다 (${path})`);
    }
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

  /**
   * media_product_type breakdown 묶음. 게시물 레벨에는 광고 지표가 없어서(Instagram
   * Login 토큰으로는 total_views·boost_ads_list가 막혀 있다) 계정 레벨의 이 breakdown이
   * 광고로 산 도달·조회수를 볼 수 있는 유일한 경로다.
   *
   * follow_type과 마찬가지로 breakdown 있는 요청은 없는 요청과 한 호출에 담을 수 없다.
   */
  async function productTypeInsights(
    window: Record<string, string>,
  ): Promise<GraphInsightResult> {
    const failed: GraphInsightResult = {
      metrics: {},
      availableMetrics: [],
      unavailableMetrics: [PRODUCT_TYPE_CAPABILITY],
    };
    try {
      const json = (await request("me/insights", {
        ...window,
        metric: PRODUCT_TYPE_METRICS.join(","),
        breakdown: PRODUCT_TYPE_CAPABILITY,
      })) as GraphInsightsResponse;
      const values = flattenInsights(json);
      const split = PRODUCT_TYPE_METRICS.some((metric) => `${metric}_ad` in values);
      if (!split) return { ...failed, metrics: values };
      return {
        metrics: values,
        availableMetrics: [PRODUCT_TYPE_CAPABILITY],
        unavailableMetrics: [],
      };
    } catch (err) {
      console.warn(
        `[graph] media_product_type breakdown 실패 — 광고/오가닉 분리를 건너뜁니다: ` +
          safeGraphMessage(err instanceof Error ? err.message : String(err)),
      );
      return failed;
    }
  }

  return {
    async getProfile() {
      const json = (await request("me", {
        fields: "user_id,username,name,biography,followers_count,profile_picture_url,media_count",
      })) as {
        user_id: string;
        username: string;
        name?: string;
        biography?: string;
        followers_count?: number;
        profile_picture_url?: string;
        media_count?: number;
      };
      return {
        userId: json.user_id,
        username: json.username,
        displayName: json.name,
        biography: json.biography,
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

    async getMediaUrl(mediaId) {
      const json = (await request(mediaId, { fields: "media_url" })) as { media_url?: string };
      return json.media_url ?? null;
    },

    async getMediaThumbnail(mediaId) {
      const json = (await request(mediaId, { fields: "thumbnail_url,media_url" })) as {
        thumbnail_url?: string;
        media_url?: string;
      };
      return json.thumbnail_url ?? json.media_url ?? null;
    },

    async getCarouselChildren(mediaId) {
      const json = (await request(mediaId, {
        fields: "children{media_url,media_type,thumbnail_url}",
      })) as GraphChildrenResponse;
      return mapCarouselChildren(json);
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
      const [base, followType, productType] = await Promise.all([
        optionalInsights("me/insights", ACCOUNT_METRICS, window),
        followTypeInsights(window),
        productTypeInsights(window),
      ]);
      return {
        // breakdown 호출의 reach·views는 breakdown 합(추산)이라 base의 정식 값을 덮지
        // 않게 뒤로 병합하지 않는다. 갈라 놓은 _ad/_organic 키만 살아남으면 된다.
        metrics: { ...followType.metrics, ...productType.metrics, ...base.metrics },
        availableMetrics: [
          ...base.availableMetrics,
          ...followType.availableMetrics,
          ...productType.availableMetrics,
        ],
        unavailableMetrics: [
          ...base.unavailableMetrics,
          ...followType.unavailableMetrics,
          ...productType.unavailableMetrics,
        ],
      };
    },
  };
}
