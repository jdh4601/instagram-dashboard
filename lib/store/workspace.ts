import type { AccountRepository } from "@/lib/store/accountRepository";
import type { ApplicationRepository } from "@/lib/store/applicationRepository";
import type { HookRepository } from "@/lib/store/hookRepository";
import type { ProfileRepository } from "@/lib/store/profileRepository";
import type { ReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import type { ReelRepository } from "@/lib/store/reelRepository";
import type { SavedStoryFormatRepository } from "@/lib/store/savedStoryFormatRepository";

/**
 * Stable storage seam used by the application.
 *
 * New adapters should implement this object rather than leaking database-specific
 * clients into routes. close() is optional because the production workspace is a
 * process singleton, while tests and maintenance commands may need deterministic cleanup.
 */
export interface WorkspaceRepositories {
  reels: ReelRepository;
  accounts: AccountRepository;
  profile: ProfileRepository;
  reelHistory: ReelHistoryRepository;
  /** 외부 신청 폼(Walla)에서 끌어온 지원 신청. */
  applications: ApplicationRepository;
  /** 손으로 모은 훅 북마크와 링크에서 만든 선택적 릴스 해체 결과. */
  hooks: HookRepository;
  /** 릴스 분석에서 담아 둔 스토리텔링 포맷 판정. 유형별 사례집이 된다. */
  storyFormats: SavedStoryFormatRepository;
  close?: () => void | Promise<void>;
}
