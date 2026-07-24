import { RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import { Button, ThemeToggle } from "@/components/ui";

interface DashboardActionsProps {
  onSync: () => void;
  syncing: boolean;
}

export function DashboardActions({ onSync, syncing }: DashboardActionsProps) {
  return (
    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
      <ThemeToggle />
      <div className="flex items-center gap-2">
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
