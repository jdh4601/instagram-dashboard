import type { AccountRepository } from "@/lib/store/accountRepository";
import type { ApplicationRepository } from "@/lib/store/applicationRepository";
import type { ProfileRepository } from "@/lib/store/profileRepository";
import type { ReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import type { ReelRepository } from "@/lib/store/reelRepository";

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
  close?: () => void | Promise<void>;
}
