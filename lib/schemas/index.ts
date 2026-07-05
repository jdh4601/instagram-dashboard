import { z } from "zod";

export const TranscriptLineSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  text: z.string(),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

// LLM 자막 심층 분석 결과 (버튼 호출 → 릴스에 캐시)
export const TranscriptInsightItemSchema = z.object({
  title: z.string(),
  detail: z.string(),
  metric: z.string().optional(), // 연결된 지표 키(예: skipRate, shareRate)
  rewrite: z.string().optional(), // 약점일 때만: 바로 쓸 수 있는 새 자막 대사 제안
});
export type TranscriptInsightItem = z.infer<typeof TranscriptInsightItemSchema>;

export const TranscriptInsightsSchema = z.object({
  summary: z.string(),
  strengths: z.array(TranscriptInsightItemSchema),
  weaknesses: z.array(TranscriptInsightItemSchema),
  generatedAt: z.string().optional(), // 캐시 시점 (서버에서 주입)
});
export type TranscriptInsights = z.infer<typeof TranscriptInsightsSchema>;

export const RetentionPointSchema = z.object({
  sec: z.number().nonnegative(),
  pct: z.number().min(0).max(100),
});
export type RetentionPoint = z.infer<typeof RetentionPointSchema>;

export const ReachSourcesSchema = z.object({
  reelsTab: z.number().min(0).max(100).optional(),
  explore: z.number().min(0).max(100).optional(),
  home: z.number().min(0).max(100).optional(),
  profile: z.number().min(0).max(100).optional(),
  other: z.number().min(0).max(100).optional(),
});
export type ReachSources = z.infer<typeof ReachSourcesSchema>;

export const DerivedRatesSchema = z.object({
  shareRate: z.number(),
  saveRate: z.number(),
  likeRate: z.number(),
  commentRate: z.number(),
  engagementRate: z.number(),
  completionRate: z.number(),
  followRate: z.number().optional(),
  followConversionRate: z.number().optional(), // followsFromReel / reach × 100
  profileVisitRate: z.number().optional(), // profileVisits / reach × 100
  interactionRateByReach: z.number().optional(),
  interactionRateByView: z.number().optional(),
  saveRateByReach: z.number().optional(),
  shareRateByReach: z.number().optional(),
  commentRateByReach: z.number().optional(),
  likeRateByReach: z.number().optional(),
  highIntentRate: z.number().optional(),
  profileToFollowRate: z.number().optional(),
  playsPerReachedAccount: z.number().optional(),
  replayRate: z.number().optional(),
  watchTimePerView: z.number().optional(),
  averageWatchPercentage: z.number().optional(),
});
export type DerivedRates = z.infer<typeof DerivedRatesSchema>;

// 과거 저장 데이터와의 호환을 위한 팔로워 / 논팔로워 비중
export const AudienceBreakdownSchema = z.object({
  followersPct: z.number().min(0).max(100),
  nonFollowersPct: z.number().min(0).max(100),
});
export type AudienceBreakdown = z.infer<typeof AudienceBreakdownSchema>;

// 과거 저장 데이터와의 호환을 위한 시청 지속 시간 분포
export const WatchTimeBucketSchema = z.object({
  label: z.string(), // 예: "0~3초", "3~10초", "10초~"
  pct: z.number().min(0).max(100),
});
export type WatchTimeBucket = z.infer<typeof WatchTimeBucketSchema>;

export const ReelSchema = z.object({
  id: z.string().min(1),
  postedAt: z.string(),
  durationSec: z.number().nonnegative(), // 0 = 길이 미상(Graph API 신규 릴스). 스샷/수동으로 보완.
  views: z.number().nonnegative(),
  reach: z.number().nonnegative(),
  likes: z.number().nonnegative(),
  comments: z.number().nonnegative(),
  saves: z.number().nonnegative(),
  shares: z.number().nonnegative(),
  avgWatchTimeSec: z.number().nonnegative(),
  totalInteractions: z.number().nonnegative().optional(),
  totalWatchTimeSec: z.number().nonnegative().optional(),
  replays: z.number().nonnegative().optional(),
  totalPlays: z.number().nonnegative().optional(),
  profileActivity: z.number().nonnegative().optional(),
  hookRetention3s: z.number().min(0).max(100).optional(),
  skipRate: z.number().min(0).max(100).optional(), // Instagram 스킵 비율(%). 3초 후 잔존률 = 100 - skipRate
  skipRateSource: z.enum(["API", "EDIT"]).optional(),
  retentionCurve: z.array(RetentionPointSchema).optional(),
  reachSources: ReachSourcesSchema.optional(),
  followsFromReel: z.number().nonnegative().optional(),
  profileVisits: z.number().nonnegative().optional(),
  caption: z.string().optional(),
  thumbnailUrl: z.string().optional(), // Graph API 썸네일
  permalink: z.string().optional(), // 인스타 원본 링크
  transcript: z.array(TranscriptLineSchema).optional(),
  transcriptInsights: TranscriptInsightsSchema.optional(),
  derived: DerivedRatesSchema.optional(),
  audienceBreakdown: AudienceBreakdownSchema.optional(),
  watchTimeBuckets: z.array(WatchTimeBucketSchema).optional(),
});
export type Reel = z.infer<typeof ReelSchema>;

// 릴스별 지표 이력 (동기화마다 누적 → 조회수/도달 추이)
export const ReelMetricSnapshotSchema = z.object({
  reelId: z.string().min(1),
  date: z.string(), // YYYY-MM-DD
  views: z.number().nonnegative(),
  reach: z.number().nonnegative(),
  likes: z.number().nonnegative(),
  comments: z.number().nonnegative(),
  saves: z.number().nonnegative(),
  shares: z.number().nonnegative(),
  totalInteractions: z.number().nonnegative().optional(),
  totalWatchTimeSec: z.number().nonnegative().optional(),
  replays: z.number().nonnegative().optional(),
  totalPlays: z.number().nonnegative().optional(),
  followsFromReel: z.number().nonnegative().optional(),
  profileVisits: z.number().nonnegative().optional(),
});
export type ReelMetricSnapshot = z.infer<typeof ReelMetricSnapshotSchema>;

// 계정 프로필 (Graph getProfile + 동기화 저장)
export const AccountProfileSchema = z.object({
  username: z.string(),
  avatarUrl: z.string().optional(),
  followersCount: z.number().nonnegative(),
  mediaCount: z.number().nonnegative(),
  updatedAt: z.string(),
});
export type AccountProfile = z.infer<typeof AccountProfileSchema>;

export const AccountSnapshotSchema = z.object({
  date: z.string(),
  followerCount: z.number().nonnegative(),
  reachLast7d: z.number().nonnegative(),
  viewsLast7d: z.number().nonnegative().optional(),
  accountsEngagedLast7d: z.number().nonnegative().optional(),
  totalInteractionsLast7d: z.number().nonnegative().optional(),
  followsLast7d: z.number().nonnegative().optional(),
  unfollowsLast7d: z.number().nonnegative().optional(),
  profileLinksTapsLast7d: z.number().nonnegative().optional(),
  availableMetrics: z.array(z.string()).optional(),
  unavailableMetrics: z.array(z.string()).optional(),
});
export type AccountSnapshot = z.infer<typeof AccountSnapshotSchema>;
