"use client";
import type { SyncProgress } from "@/lib/graph/sync";
import { syncProgressLabel, syncProgressPercent } from "@/lib/ui/syncProgress";

interface SyncProgressBarProps {
  progress: SyncProgress;
}

export function SyncProgressBar({ progress }: SyncProgressBarProps) {
  const percent = syncProgressPercent(progress);
  const label = syncProgressLabel(progress);

  return (
    <div className="border-b border-border-subtle bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6">
        <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-600">
          <span>동기화 중 · {label}</span>
          <span className="tabular-nums font-medium text-neutral-900">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="동기화 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={label}
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
