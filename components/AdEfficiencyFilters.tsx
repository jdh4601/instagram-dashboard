"use client";
import { Film, GalleryHorizontalEnd, LayoutGrid } from "lucide-react";
import type { AdEfficiencySort } from "@/lib/analysis/adEfficiency";
import { AD_RESULT_LABELS, type MediaKind } from "@/lib/schemas";
import { cn } from "@/components/ui";

export interface AdFilterState {
  mediaType?: MediaKind;
  resultType?: string;
}

interface Props {
  filter: AdFilterState;
  onFilter: (next: AdFilterState) => void;
  sort: AdEfficiencySort;
  onSort: (sort: AdEfficiencySort) => void;
  /** 지금 데이터에 실제로 있는 결과 유형만 칩으로 낸다. 누를 수 없는 칩은 군더더기다. */
  availableResultTypes: string[];
  /** 거른 뒤 남은 건수 / 전체 건수 */
  shown: number;
  total: number;
}

const MEDIA_CHIPS: Array<{ value?: MediaKind; label: string; Icon: typeof Film }> = [
  { value: undefined, label: "전체", Icon: LayoutGrid },
  { value: "REELS", label: "릴스", Icon: Film },
  { value: "CAROUSEL", label: "캐러셀", Icon: GalleryHorizontalEnd },
];

/** 정렬 기준. 비용은 싼 쪽이, 나머지는 큰 쪽이 위로 온다 — 라벨에 방향을 적어 둔다. */
const SORTS: Array<{ value: AdEfficiencySort; label: string }> = [
  { value: "spend", label: "지출 많은 순" },
  { value: "adReach", label: "도달 큰 순" },
  { value: "cpm", label: "CPM 싼 순" },
  { value: "costPerResult", label: "결과 단가 싼 순" },
  { value: "resultRate", label: "결과율 높은 순" },
];

export function AdEfficiencyFilters({
  filter,
  onFilter,
  sort,
  onSort,
  availableResultTypes,
  shown,
  total,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Group label="형식">
        {MEDIA_CHIPS.map(({ value, label, Icon }) => (
          <Chip
            key={label}
            active={filter.mediaType === value}
            onClick={() => onFilter({ ...filter, mediaType: value })}
          >
            <Icon size={12} aria-hidden />
            {label}
          </Chip>
        ))}
      </Group>

      {/* 유형이 한 가지뿐이면 고를 것이 없어 칩 줄을 통째로 감춘다. */}
      {availableResultTypes.length > 1 && (
        <Group label="목표">
          <Chip
            active={filter.resultType === undefined}
            onClick={() => onFilter({ ...filter, resultType: undefined })}
          >
            전체
          </Chip>
          {availableResultTypes.map((type) => (
            <Chip
              key={type}
              active={filter.resultType === type}
              onClick={() => onFilter({ ...filter, resultType: type })}
            >
              {AD_RESULT_LABELS[type as keyof typeof AD_RESULT_LABELS] ?? type}
            </Chip>
          ))}
        </Group>
      )}

      <label className="flex items-center gap-1.5 text-xs text-neutral-500">
        정렬
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as AdEfficiencySort)}
          className="min-h-9 rounded-lg border border-border-subtle bg-surface px-2 py-1 text-xs text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <span className="ml-auto text-xs tabular-nums text-neutral-400">
        {shown === total ? `${total}건` : `${shown} / ${total}건`}
      </span>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        active
          ? "bg-brand-600 text-white"
          : "bg-surface-muted text-neutral-600 hover:text-neutral-900",
      )}
    >
      {children}
    </button>
  );
}
