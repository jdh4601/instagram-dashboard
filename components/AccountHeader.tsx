import { TrendingUp, TrendingDown, User } from "lucide-react";
import type { AccountProfile } from "@/lib/schemas";

interface AccountHeaderProps {
  profile: AccountProfile | null;
  followerDelta: number | null;
  /** 실제 동기화된 게시물 수. 목록에서 세는 숫자와 일치해야 한다. */
  contentCount: number;
}

export function AccountHeader({ profile, followerDelta, contentCount }: AccountHeaderProps) {
  const username = profile?.username ?? "계정 미연결";
  const followers = profile?.followersCount ?? 0;
  // Instagram의 media_count는 집계 기준이 달라 실제 수집분과 어긋날 수 있다.
  // 화면에는 실제 개수를 쓰고, 다를 때만 IG 값을 툴팁으로 병기한다.
  const igCount = profile?.mediaCount ?? null;
  const countMismatch = igCount !== null && igCount !== contentCount;
  const displayName = profile?.displayName?.trim();
  const biography = profile?.biography?.trim();

  return (
    <div className="flex items-start gap-3">
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
          {profile && (
            <span
              className="tabular-nums"
              title={countMismatch ? `Instagram 집계 ${igCount!.toLocaleString()}` : undefined}
            >
              콘텐츠 {contentCount.toLocaleString()}
            </span>
          )}
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
        {displayName && (
          <div className="mt-1.5 text-sm font-semibold text-neutral-900">{displayName}</div>
        )}
        {biography && (
          // 인스타그램 프로필과 같은 자리·같은 줄바꿈으로 둔다. <br> 대신 CSS로 살려야
          // 원문이 그대로 남아 복사와 검색이 된다.
          <p className="mt-0.5 max-w-prose whitespace-pre-line text-sm leading-snug text-neutral-600">
            {biography}
          </p>
        )}
      </div>
    </div>
  );
}
