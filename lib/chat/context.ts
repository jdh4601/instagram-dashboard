import type { AccountProfile, AccountSnapshot, Reel } from "@/lib/schemas";
import { BENCHMARKS_BY_KIND, type MetricKey } from "@/config/benchmarks";
import { buildAccountOverview, type AccountOverview } from "@/lib/analysis/accountOverview";
import {
  accountFunnelVerdicts,
  buildAccountFunnel,
  type AccountFunnel,
  type AccountFunnelVerdicts,
} from "@/lib/analysis/accountFunnel";
import { buildAudienceMix, type AudienceMix } from "@/lib/analysis/audienceMix";
import { computeDashboardMetrics, type DashboardMetrics } from "@/lib/analysis/dashboardMetrics";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { diagnoseRecent, type RecentDiagnosis } from "@/lib/analysis/recentDiagnosis";
import { mediaKindOf } from "@/lib/media/kind";

/**
 * 프롬프트에 실을 게시물 수. 계정 전체를 넣으면 릴스가 늘어날수록 컨텍스트가 무한정
 * 커져 비용과 응답 품질이 같이 나빠진다. 최근 흐름을 읽기에 충분한 크기로 고정한다.
 */
export const MAX_CONTEXT_REELS = 20;

const CAPTION_MAX = 40;
const MISSING = "데이터 부족";

export interface ReelContextRow {
  id: string;
  postedAt: string;
  kind: string;
  caption: string;
  views: number;
  reach: number;
  engagementRate: number;
  hookRetention3s: number | null;
  saveRate: number;
  shareRate: number;
  follows: number | null;
}

export interface AccountContext {
  profile: {
    username: string | null;
    followers: number;
    contentCount: number;
  };
  overview: AccountOverview;
  funnel: AccountFunnel | null;
  funnelVerdicts: AccountFunnelVerdicts | null;
  audienceMix: AudienceMix | null;
  reelMetrics: DashboardMetrics;
  diagnosis: RecentDiagnosis;
  reels: ReelContextRow[];
}

function truncate(caption: string | undefined): string {
  if (!caption) return "(캡션 없음)";
  const oneLine = caption.replace(/\s+/g, " ").trim();
  if (oneLine === "") return "(캡션 없음)";
  return oneLine.length > CAPTION_MAX ? `${oneLine.slice(0, CAPTION_MAX)}…` : oneLine;
}

function toRow(reel: Reel): ReelContextRow {
  const derived = computeDerivedRates(reel);
  return {
    id: reel.id,
    postedAt: reel.postedAt.slice(0, 10),
    kind: mediaKindOf(reel) === "CAROUSEL" ? "캐러셀" : "릴스",
    caption: truncate(reel.caption),
    views: reel.views,
    reach: reel.reach,
    engagementRate: derived.engagementRate,
    hookRetention3s: reel.hookRetention3s ?? null,
    saveRate: derived.saveRate,
    shareRate: derived.shareRate,
    follows: reel.followsFromReel ?? null,
  };
}

/**
 * 대시보드가 이미 계산해 둔 결과를 한 덩어리로 모은다. 새 분석 로직은 만들지 않는다 —
 * 챗봇이 화면과 다른 숫자를 말하면 그 자체로 버그이기 때문이다.
 */
export function buildAccountContext(
  reels: Reel[],
  snapshots: AccountSnapshot[],
  profile: AccountProfile | null,
): AccountContext {
  const funnel = buildAccountFunnel(snapshots);
  const recent = [...reels]
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .slice(0, MAX_CONTEXT_REELS);

  return {
    profile: {
      username: profile?.username ?? null,
      followers: profile?.followersCount ?? snapshots.at(-1)?.followerCount ?? 0,
      contentCount: reels.length,
    },
    overview: buildAccountOverview(reels, snapshots, profile),
    funnel,
    funnelVerdicts: funnel ? accountFunnelVerdicts(funnel) : null,
    audienceMix: buildAudienceMix(snapshots),
    reelMetrics: computeDashboardMetrics(reels.filter((r) => mediaKindOf(r) === "REELS")),
    diagnosis: diagnoseRecent(reels),
    reels: recent.map(toRow),
  };
}

function num(value: number | null | undefined): string {
  return value === null || value === undefined ? MISSING : value.toLocaleString("ko-KR");
}

function pct(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? MISSING : `${value.toFixed(digits)}%`;
}

function signed(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING;
  return `${value > 0 ? "+" : ""}${value.toLocaleString("ko-KR")}`;
}

function renderProfile(context: AccountContext): string {
  const { profile, overview } = context;
  return [
    "[계정]",
    `- 사용자명: ${profile.username ? `@${profile.username}` : MISSING}`,
    `- 팔로워: ${num(profile.followers)}명 (직전 스냅샷 대비 ${signed(overview.followerDelta)})`,
    `- 수집된 게시물: ${num(profile.contentCount)}개`,
    `- 평균 참여율: ${pct(overview.avgEngagementRate)}`,
  ].join("\n");
}

function renderAccountMetrics(context: AccountContext): string {
  const { overview } = context;
  return [
    "[최근 7일 계정 지표]",
    `- 계정 도달: ${overview.reachAvailable ? num(overview.reachLast7d) : MISSING}`,
    `- 조회: ${num(overview.viewsLast7d)}`,
    `- 참여한 계정: ${num(overview.accountsEngagedLast7d)}`,
    `- 순 팔로워 증가: ${signed(overview.netFollowersLast7d)}`,
    `- 도달→팔로우 전환율: ${pct(overview.followConversionRateLast7d)}`,
  ].join("\n");
}

const FUNNEL_ROWS = [
  { key: "viewRate", label: "계정 방문률(도달→프로필 방문)" },
  { key: "followRate", label: "팔로우 전환율(방문→팔로우)" },
  { key: "linkClickRate", label: "링크 클릭률(방문→링크클릭)" },
] as const;

function renderFunnel(context: AccountContext): string {
  const { funnel, funnelVerdicts } = context;
  if (!funnel) return `[전환 퍼널]\n- ${MISSING} (계정 스냅샷이 아직 없습니다)`;

  const rows = FUNNEL_ROWS.map(({ key, label }) => {
    const verdict = funnelVerdicts?.[key];
    const delta = funnel.deltas[key];
    const deltaText = delta === null ? MISSING : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%p`;
    return `- ${label}: ${pct(funnel[key])}${verdict ? ` [${verdict}]` : ""} (직전 대비 ${deltaText})`;
  });

  return [
    `[전환 퍼널] (${funnel.date} 기준)`,
    `- 도달 ${num(funnel.reach)} → 프로필 방문 ${num(funnel.profileViews)} → 팔로우 ${num(funnel.follows)} / 링크클릭 ${num(funnel.websiteClicks)}`,
    ...rows,
  ].join("\n");
}

function renderAudienceMix(context: AccountContext): string {
  const mix = context.audienceMix;
  if (!mix) return `[도달 구성]\n- ${MISSING} (팔로워/비팔로워 분해가 아직 수집되지 않았습니다)`;
  return [
    `[도달 구성] (${mix.date} 기준)`,
    `- 팔로워 도달: ${num(mix.followerReach)} (${(100 - mix.nonFollowerShare).toFixed(1)}%)`,
    `- 비팔로워 도달: ${num(mix.nonFollowerReach)} (${mix.nonFollowerShare.toFixed(1)}%)`,
  ].join("\n");
}

function renderReelMetrics(context: AccountContext): string {
  const m = context.reelMetrics;
  return [
    "[릴스 종합]",
    `- 평균 시청 시간: ${m.avgWatchTimeSec === null ? MISSING : `${m.avgWatchTimeSec.toFixed(1)}초`}`,
    `- 평균 시청 비율: ${pct(m.completionRate, 1)}`,
    `- 평균 영상 길이: ${m.avgDurationSec === null ? MISSING : `${m.avgDurationSec.toFixed(1)}초`}`,
    `- 평균 스킵률: ${pct(m.skipRate, 1)}`,
  ].join("\n");
}

function renderDiagnosis(context: AccountContext): string {
  const { diagnosis } = context;
  const list = (items: typeof diagnosis.strengths) =>
    items.length === 0
      ? "  (없음)"
      : items
          .map(
            (v) =>
              `  - ${v.label}: ${v.value.toFixed(2)}% (약점 기준 ${v.threshold.weakBelow} / 강점 기준 ${v.threshold.strongAbove})`,
          )
          .join("\n");

  return [
    `[최근 ${diagnosis.reelCount}개 릴스 진단]`,
    `요약: ${diagnosis.summary}`,
    "강점:",
    list(diagnosis.strengths),
    "약점:",
    list(diagnosis.weaknesses),
  ].join("\n");
}

function renderReelTable(context: AccountContext): string {
  if (context.reels.length === 0) return `[최근 게시물]\n- ${MISSING} (수집된 게시물이 없습니다)`;

  const rows = context.reels.map((r) =>
    [
      r.postedAt,
      r.kind,
      r.caption,
      `조회 ${num(r.views)}`,
      `도달 ${num(r.reach)}`,
      `참여율 ${r.engagementRate.toFixed(2)}%`,
      `3초잔존 ${r.hookRetention3s === null ? MISSING : `${r.hookRetention3s.toFixed(0)}%`}`,
      `저장율 ${r.saveRate.toFixed(2)}%`,
      `공유율 ${r.shareRate.toFixed(2)}%`,
      `팔로우 ${num(r.follows)}`,
      `id=${r.id}`,
    ].join(" | "),
  );

  return [`[최근 게시물 ${context.reels.length}개] (최신순)`, ...rows].join("\n");
}

// 임계값을 같이 실어야 모델이 "왜 약점인지"를 대시보드와 같은 근거로 말한다.
// 이 표가 없으면 모델이 자기 감각으로 기준을 지어내 화면과 결론이 어긋난다.
function renderBenchmarks(): string {
  const table = BENCHMARKS_BY_KIND.REELS;
  const rows = (Object.keys(table) as MetricKey[])
    .map((key) => {
      const t = table[key];
      if (!t) return null;
      return `- ${t.label}: ${t.weakBelow} 미만이면 약점, ${t.strongAbove} 초과면 강점`;
    })
    .filter((row): row is string => row !== null);

  return ["[판정 기준] (강약은 반드시 이 표로만 판정한다)", ...rows].join("\n");
}

/** 컨텍스트 팩을 system 프롬프트에 실을 평문으로 렌더링한다. */
export function renderAccountContext(context: AccountContext): string {
  return [
    renderProfile(context),
    renderAccountMetrics(context),
    renderFunnel(context),
    renderAudienceMix(context),
    renderReelMetrics(context),
    renderDiagnosis(context),
    renderReelTable(context),
    renderBenchmarks(),
  ].join("\n\n");
}
