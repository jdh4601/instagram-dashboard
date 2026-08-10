import { z } from "zod";
import { ReelAnalysisSchema } from "@/lib/schemas/reelAnalysis";

const TranscriptLineSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  text: z.string(),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

// LLM 자막 심층 분석 결과 (버튼 호출 → 릴스에 캐시)
const TranscriptInsightItemSchema = z.object({
  title: z.string(),
  detail: z.string(),
  metric: z.string().optional(), // 연결된 지표 키(예: skipRate, shareRate)
  rewrite: z.string().optional(), // 약점일 때만: 바로 쓸 수 있는 새 자막 대사 제안
});
export const TranscriptInsightsSchema = z.object({
  summary: z.string(),
  strengths: z.array(TranscriptInsightItemSchema),
  weaknesses: z.array(TranscriptInsightItemSchema),
  generatedAt: z.string().optional(), // 캐시 시점 (서버에서 주입)
});
export type TranscriptInsights = z.infer<typeof TranscriptInsightsSchema>;

const DerivedRatesSchema = z.object({
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

// 이 대시보드가 다루는 미디어 종류. 인스타그램의 media_product_type/media_type을
// 대시보드가 쓰는 두 값으로 좁힌 것이다.
const MediaKindSchema = z.enum(["REELS", "CAROUSEL"]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

export const ReelSchema = z.object({
  id: z.string().min(1),
  // 없으면 릴스. 이 필드가 생기기 전에 저장된 데이터는 전부 릴스뿐이었다.
  mediaType: MediaKindSchema.optional(),
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
  followsFromReel: z.number().nonnegative().optional(),
  profileVisits: z.number().nonnegative().optional(),
  caption: z.string().optional(),
  thumbnailUrl: z.string().optional(), // Graph API 썸네일
  permalink: z.string().optional(), // 인스타 원본 링크
  transcript: z.array(TranscriptLineSchema).optional(),
  transcriptInsights: TranscriptInsightsSchema.optional(),
  // 캐시된 mp4의 파일명(경로가 아니다). 디렉토리는 런타임 설정에서 오고, 파일 열기는
  // 이 값이 아니라 릴스 id에서 다시 만든다 — lib/media/videoCache.ts 참고.
  videoFile: z.string().optional(),
  // 분석 탭 4개가 함께 쓰는 LLM 캐시. 한 번 호출해 받아 둔다.
  // 분석 스키마가 바뀌면 예전 구조로 캐시된 값이 남는다. catch로 받아내지 않으면
  // 그 릴스 전체가 파싱에 실패해 대시보드가 통째로 빈다. 분석만 버리고 릴스는 살린다.
  reelAnalysis: ReelAnalysisSchema.optional().catch(undefined),
  derived: DerivedRatesSchema.optional(),
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
  // 프로필 표시 이름과 바이오. 계정이 비워 둘 수 있는 값이라 Graph가 필드를 생략한다.
  displayName: z.string().optional(),
  biography: z.string().optional(),
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
  // 계정 레벨 프로필 방문. 게시물 레벨 profile_visits는 릴스에서 미지원이라
  // 도달→방문→팔로우 퍼널의 중간 단계를 이 값으로만 채울 수 있다.
  profileViewsLast7d: z.number().nonnegative().optional(),
  // 바이오 링크 클릭 수. 프로필 방문에서 팔로우와 나란히 갈라지는 결과다.
  websiteClicksLast7d: z.number().nonnegative().optional(),
  // 연락처 버튼(주소·통화·이메일·텍스트) 누름. 바이오 링크가 아니다.
  profileLinksTapsLast7d: z.number().nonnegative().optional(),
  // reach의 follow_type breakdown(계정 레벨만 지원). 도달이 신규 유입인지 기존 팬의
  // 반복 소비인지 가른다. 게시물 레벨은 미지원이라 없을 수 있어 optional.
  followerReachLast7d: z.number().nonnegative().optional(),
  nonFollowerReachLast7d: z.number().nonnegative().optional(),
  availableMetrics: z.array(z.string()).optional(),
  unavailableMetrics: z.array(z.string()).optional(),
});
export type AccountSnapshot = z.infer<typeof AccountSnapshotSchema>;

/**
 * 외부 신청 폼(Walla)에 접수된 지원 신청 한 건.
 *
 * 바이오 링크 클릭 다음 단계라 Graph가 알려 줄 수 없는 구간이다. 클릭은 계정 레벨
 * 집계 수치(websiteClicksLast7d)로만 오고 개별 클릭에 신원이 없어서, 두 데이터를
 * 잇는 유일한 키가 링크에 붙인 UTM이다.
 *
 * 신청자의 이름·연락처 같은 응답 본문은 담지 않는다. 대시보드가 하는 일은 집계뿐이고,
 * 개인정보를 로컬 JSON으로 복제하면 보관 책임만 늘어난다.
 */
export const ApplicationSchema = z.object({
  responseId: z.string().min(1),
  /** 제출 시각(ISO 8601). Walla의 submittedAt을 그대로 쓴다. */
  submittedAt: z.string(),
  /** 유입 매체(instagram, naver 등). 링크에 UTM이 없으면 undefined. */
  source: z.string().optional(),
  /** 유입 경로(bio, story, paid 등). websiteClicks와 분모를 맞출 때 이 값으로 거른다. */
  medium: z.string().optional(),
  campaign: z.string().optional(),
  /** 크리에이티브·릴스 단위 구분. 광고 소재별 성과를 가르는 키다. */
  content: z.string().optional(),
});
export type Application = z.infer<typeof ApplicationSchema>;

// 릴스 분석 탭(Idea·Hook·Storytelling) 스키마는 별도 모듈에 있다. 소비자가 한 곳에서
// 가져올 수 있게 여기서 다시 내보낸다.
export * from "@/lib/schemas/reelAnalysis";

// 훅 보관함은 릴스 지표와 공유하는 필드가 없어 파일을 따로 둔다.
export * from "./hook";
