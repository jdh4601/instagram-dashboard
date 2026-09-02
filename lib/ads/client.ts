import {
  buildAdPerformance,
  type AdPerformance,
  type GraphAd,
  type GraphAdInsight,
} from "@/lib/ads/map";
import {
  buildAdUnits,
  type AdUnit,
  type GraphAdSet,
  type GraphCampaign,
} from "@/lib/ads/adUnit";

const DEFAULT_BASE = "https://graph.facebook.com";
const VERSION = "v23.0";

// 한 광고 계정이 돌려주는 페이지 상한. 부스트는 건수가 많지 않아 이 정도면 넉넉하다.
const PAGE_SIZE = "100";
const MAX_PAGES = 10;

const AD_FIELDS = "id,name,effective_status,creative{effective_instagram_media_id,instagram_permalink_url}";
const INSIGHT_FIELDS = "ad_id,spend,reach,impressions,frequency,cpm,clicks,actions";

// 광고 단위 화면은 상태·목표·예산·기간까지 필요해서 요청 필드가 더 넓다. 효율표가
// 쓰는 위 필드를 넓히지 않고 따로 두는 이유는, 게시물 단위 합산이 쓰지 않는 값을
// 받느라 그쪽 응답까지 무거워지지 않게 하려는 것이다.
const AD_UNIT_FIELDS =
  "id,name,effective_status,created_time,adset_id,campaign_id," +
  "creative{effective_instagram_media_id,instagram_permalink_url,thumbnail_url}";
const ADSET_FIELDS =
  "id,optimization_goal,daily_budget,lifetime_budget,start_time,end_time,effective_status";
const CAMPAIGN_FIELDS = "id,name,objective,daily_budget,lifetime_budget";
const AD_UNIT_INSIGHT_FIELDS =
  "ad_id,spend,reach,impressions,frequency,cpm,clicks,actions," +
  "video_play_actions,video_thruplay_watched_actions,cost_per_action_type";

export interface AdAccount {
  id: string;
  name?: string;
  currency?: string;
}

interface FetchResult {
  ok: boolean;
  json(): Promise<unknown>;
}
type FetchLike = (url: string) => Promise<FetchResult>;

interface Options {
  accessToken: string;
  baseURL?: string;
  fetchImpl?: FetchLike;
}

/** 요청이 실패한 이유. 설정 화면이 "어디를 고쳐야 하는지"를 이걸로 고른다. */
export class AdsRequestError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "AdsRequestError";
  }
}

export interface AdsClient {
  listAdAccounts(): Promise<AdAccount[]>;
  /** 기간 내 게시물별 광고 성과. 인스타 게시물에 붙지 않은 광고는 빠진다. */
  listAdPerformance(adAccountId: string, range: { since: string; until: string }): Promise<AdPerformance[]>;
  /** 기간 내 광고 한 건씩. 게시물에 붙지 않은 광고도 그대로 남는다. */
  listAdUnits(adAccountId: string, range: { since: string; until: string }): Promise<AdUnit[]>;
}

export function createAdsClient(opts: Options): AdsClient {
  const base = opts.baseURL ?? DEFAULT_BASE;
  const fetchImpl: FetchLike =
    opts.fetchImpl ?? ((url) => fetch(url) as unknown as Promise<FetchResult>);

  function safeMessage(message: string): string {
    if (!opts.accessToken) return message;
    return message
      .replaceAll(opts.accessToken, "[REDACTED]")
      .replaceAll(encodeURIComponent(opts.accessToken), "[REDACTED]");
  }

  async function request(path: string, params: Record<string, string>): Promise<unknown> {
    // Graph 규약대로 access_token을 쿼리스트링에 싣는다. 이 URL은 자격증명을
    // 포함하므로 요청 URL 전체를 로깅하는 코드는 절대 추가하지 말 것.
    const query = new URLSearchParams({ ...params, access_token: opts.accessToken });
    let res: FetchResult;
    try {
      res = await fetchImpl(`${base}/${VERSION}/${path}?${query.toString()}`);
    } catch {
      // fetch 구현체가 토큰이 든 URL을 원문 오류에 넣을 수 있어 일반화한다.
      throw new AdsRequestError("Marketing API 요청에 실패했습니다");
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new AdsRequestError(`Marketing API 응답을 읽지 못했습니다 (${path})`);
    }
    if (!res.ok) {
      const error = (json as { error?: { message?: string; code?: number } })?.error;
      throw new AdsRequestError(
        safeMessage(error?.message ?? `Marketing API 오류 (${path})`),
        error?.code,
      );
    }
    return json;
  }

  /** paging.next를 따라가며 data를 모은다. 상한을 넘으면 조용히 자르지 않고 멈춘다. */
  async function collect<T>(path: string, params: Record<string, string>): Promise<T[]> {
    const rows: T[] = [];
    let page = (await request(path, { ...params, limit: PAGE_SIZE })) as {
      data?: T[];
      paging?: { cursors?: { after?: string } };
    };
    for (let pageCount = 0; pageCount < MAX_PAGES; pageCount++) {
      rows.push(...(page.data ?? []));
      const after = page.paging?.cursors?.after;
      if (!after || (page.data ?? []).length === 0) return rows;
      if (pageCount + 1 >= MAX_PAGES) {
        throw new AdsRequestError(`Marketing API 페이지가 안전 상한(${MAX_PAGES})을 넘었습니다`);
      }
      page = (await request(path, { ...params, limit: PAGE_SIZE, after })) as typeof page;
    }
    return rows;
  }

  return {
    async listAdAccounts() {
      const json = (await request("me/adaccounts", { fields: "id,name,currency" })) as {
        data?: AdAccount[];
      };
      return json.data ?? [];
    },

    async listAdPerformance(adAccountId, range) {
      const timeRange = JSON.stringify({ since: range.since, until: range.until });
      // 광고 목록과 성과를 따로 받아 ad_id로 맞물린다. 중첩 insights로 한 번에 받을
      // 수도 있지만, 그러면 성과가 없는 광고가 통째로 빠져 "태웠는데 아직 안 도는
      // 광고"를 화면에서 구분할 수 없다.
      const [ads, insights] = await Promise.all([
        collect<GraphAd>(`${adAccountId}/ads`, { fields: AD_FIELDS }),
        collect<GraphAdInsight>(`${adAccountId}/insights`, {
          level: "ad",
          fields: INSIGHT_FIELDS,
          time_range: timeRange,
        }),
      ]);
      return buildAdPerformance(ads, insights);
    },

    async listAdUnits(adAccountId, range) {
      const timeRange = JSON.stringify({ since: range.since, until: range.until });
      // 통화까지 함께 받는다. 예산이 계정 통화의 최소 단위로 오기 때문에, 통화를
      // 모르면 원화 2,000원과 달러 20.00달러를 구분할 수 없다.
      const [account, ads, adsets, campaigns, insights] = await Promise.all([
        request(adAccountId, { fields: "currency" }) as Promise<{ currency?: string }>,
        collect<GraphAd>(`${adAccountId}/ads`, { fields: AD_UNIT_FIELDS }),
        collect<GraphAdSet>(`${adAccountId}/adsets`, { fields: ADSET_FIELDS }),
        collect<GraphCampaign>(`${adAccountId}/campaigns`, { fields: CAMPAIGN_FIELDS }),
        collect<GraphAdInsight>(`${adAccountId}/insights`, {
          level: "ad",
          fields: AD_UNIT_INSIGHT_FIELDS,
          time_range: timeRange,
        }),
      ]);

      return buildAdUnits({
        ads,
        adsets,
        campaigns,
        insights,
        currency: account.currency ?? "KRW",
      });
    },
  };
}
