import { TrendingUp, TrendingDown, User } from "lucide-react";
import type { AccountProfile } from "@/lib/schemas";

interface AccountHeaderProps {
  profile: AccountProfile | null;
  followerDelta: number | null;
}

export function AccountHeader({ profile, followerDelta }: AccountHeaderProps) {
  const username = profile?.username ?? "계정 미연결";
  const followers = profile?.followersCount ?? 0;

  return (
    <div className="flex items-center gap-3">
      {profile?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt={username}
          className="h-12 w-12 rounded-full border border-border-subtle object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-subtle bg-surface-muted text-neutral-400">
          <User size={22} />
        </div>
      )}
      <div>
        <div className="text-base font-semibold text-neutral-900">@{username}</div>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <span className="tabular-nums">팔로워 {followers.toLocaleString()}</span>
          {profile && <span className="tabular-nums">콘텐츠 {profile.mediaCount.toLocaleString()}</span>}
          {followerDelta !== null && followerDelta !== 0 && (
            <span
              className={
                followerDelta > 0
                  ? "inline-flex items-center gap-0.5 text-band-strong"
                  : "inline-flex items-center gap-0.5 text-band-weak"
              }
            >
              {followerDelta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(followerDelta).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
