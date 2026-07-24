"use client";
import { MEDIA_FILTER_LABELS, type MediaFilter } from "@/lib/ui/mediaFilter";
import { cn } from "@/components/ui";

interface Props {
  value: MediaFilter;
  onChange: (value: MediaFilter) => void;
}

export function MediaTypeToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="미디어 종류 필터"
      className="flex gap-1 rounded-lg border border-border-subtle bg-surface p-0.5"
    >
      {(Object.keys(MEDIA_FILTER_LABELS) as MediaFilter[]).map((filter) => (
        <button
          type="button"
          key={filter}
          onClick={() => onChange(filter)}
          aria-pressed={value === filter}
          className={cn(
            "min-h-11 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-8",
            value === filter ? "bg-brand-600 text-white" : "text-neutral-600 hover:bg-surface-muted",
          )}
        >
          {MEDIA_FILTER_LABELS[filter]}
        </button>
      ))}
    </div>
  );
}
