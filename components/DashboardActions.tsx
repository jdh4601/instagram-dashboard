import { RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import { Button, ThemeToggle } from "@/components/ui";
import { syncedAgoLabel } from "@/lib/ui/syncedAgo";

interface DashboardActionsProps {
  onSync: () => void;
  syncing: boolean;
  /** 마지막으로 동기화에 성공한 시각(ISO). 한 번도 안 했으면 null. */
  lastSyncedAt: string | null;
  /** 테스트에서 기준 시각을 고정하기 위한 주입점. 화면에서는 현재 시각을 쓴다. */
  now?: Date;
}

export function DashboardActions({
  onSync,
  syncing,
  lastSyncedAt,
  now,
}: DashboardActionsProps) {
  // 카드마다 흩어져 있던 "... 기준" 라벨을 걷어낸 대신, 데이터가 얼마나 오래됐는지는
  // 갱신 수단인 동기화 버튼 옆 한 곳에서만 말한다.
  const syncedAgo = syncedAgoLabel(lastSyncedAt, now ?? new Date());

  return (
    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
      <ThemeToggle />
      <div className="flex items-center gap-2">
        {/* 좁은 화면에서는 토글·버튼·설정만으로 헤더가 꽉 차 문구가 줄을 넘긴다. */}
        {syncedAgo && (
          <span className="hidden text-xs tabular-nums text-neutral-500 sm:inline">
            {syncedAgo}
          </span>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={onSync}
          disabled={syncing}
          icon={<RefreshCw size={14} className={syncing ? "animate-spin" : undefined} />}
        >
          {syncing ? "동기화 중…" : "동기화"}
        </Button>
        <Link
          href="/settings"
          title="설정"
          aria-label="설정"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-surface-muted hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:h-8 sm:w-8"
        >
          <Settings size={16} />
        </Link>
      </div>
    </div>
  );
}
