import Link from "next/link";
import type { AdEfficiencyRow, AdEfficiencySort, AdEfficiencyTotals } from "@/lib/analysis/adEfficiency";
import { detailPathForMedia } from "@/lib/ui/navigation";
import { fmtCount, fmtPct, fmtWon } from "@/lib/ui/format";

interface Props {
  rows: AdEfficiencyRow[];
  totals: AdEfficiencyTotals | null;
  sort: AdEfficiencySort;
  onSort: (sort: AdEfficiencySort) => void;
}

const COLUMNS: Array<{ key: AdEfficiencySort | null; label: string; hint?: string }> = [
  { key: null, label: "게시물" },
  { key: "spend", label: "지출" },
  { key: null, label: "광고 도달" },
  { key: "cpm", label: "CPM", hint: "노출 1,000회당" },
  { key: "costPerEngagement", label: "참여 단가", hint: "좋아요·댓글·공유·저장 1건당" },
  { key: null, label: "광고 반응률" },
  { key: null, label: "오가닉 반응률" },
  { key: "efficiencyRatio", label: "대비", hint: "광고÷오가닉" },
];

/** 계산할 수 없는 칸. 0으로 채우면 "0원에 샀다"로 읽혀 판단을 망친다. */
const NONE = "—";

function money(value: number | null): string {
  return value === null ? NONE : fmtWon(value);
}

function rate(value: number | null): string {
  return value === null ? NONE : fmtPct(value);
}

export function AdEfficiencyTable({ rows, totals, sort, onSort }: Props) {
  return (
    // 열이 여덟 개라 좁은 화면에서는 표만 가로로 흐른다. 페이지 본문은 넘치지 않는다.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left">
            {COLUMNS.map((column) => (
              <th key={column.label} className="px-3 py-2 font-medium text-neutral-500">
                {column.key === null ? (
                  <span>{column.label}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSort(column.key!)}
                    aria-pressed={sort === column.key}
                    className={`rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                      sort === column.key ? "text-brand-600" : "hover:text-neutral-800"
                    }`}
                  >
                    {column.label}
                    {sort === column.key ? " ▾" : ""}
                  </button>
                )}
                {column.hint && (
                  <span className="block text-[11px] font-normal text-neutral-400">
                    {column.hint}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.mediaId} className="border-b border-border-subtle last:border-0">
              <td className="px-3 py-2">
                <Link
                  href={detailPathForMedia(row.mediaType, row.mediaId)}
                  className="block max-w-64 truncate rounded-sm font-medium text-neutral-900 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  {row.caption?.trim() || "(캡션 없음)"}
                </Link>
                <span className="text-xs text-neutral-400">
                  {row.postedAt.slice(0, 10)}
                  {row.adCount > 1 ? ` · 광고 ${row.adCount}건` : ""}
                </span>
              </td>
              <td className="px-3 py-2 font-semibold tabular-nums text-neutral-900">
                {fmtWon(row.spend)}
              </td>
              <td className="px-3 py-2 tabular-nums text-neutral-700">{fmtCount(row.adReach)}</td>
              <td className="px-3 py-2 tabular-nums text-neutral-700">{money(row.cpm)}</td>
              <td className="px-3 py-2 font-semibold tabular-nums text-neutral-900">
                {money(row.costPerEngagement)}
              </td>
              <td className="px-3 py-2 tabular-nums text-neutral-700">
                {rate(row.adEngagementRate)}
              </td>
              <td className="px-3 py-2 tabular-nums text-neutral-500">
                {rate(row.organicEngagementRate)}
              </td>
              <td className="px-3 py-2">
                <Ratio value={row.efficiencyRatio} />
              </td>
            </tr>
          ))}
        </tbody>
        {totals && rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-border-subtle bg-surface-muted font-semibold">
              <td className="px-3 py-2 text-neutral-500">합계 · {totals.postCount}건</td>
              <td className="px-3 py-2 tabular-nums text-neutral-900">{fmtWon(totals.spend)}</td>
              <td className="px-3 py-2 tabular-nums text-neutral-700">{fmtCount(totals.adReach)}</td>
              <td className="px-3 py-2 tabular-nums text-neutral-700">{money(totals.cpm)}</td>
              <td className="px-3 py-2 tabular-nums text-neutral-900">
                {money(totals.costPerEngagement)}
              </td>
              <td className="px-3 py-2" colSpan={3} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** 1을 넘으면 산 도달이 오가닉보다 더 반응했다는 뜻이라 눈에 띄게 둔다. */
function Ratio({ value }: { value: number | null }) {
  if (value === null) return <span className="text-neutral-400">{NONE}</span>;
  return (
    <span
      className={`tabular-nums font-semibold ${value >= 1 ? "text-band-strong" : "text-neutral-600"}`}
    >
      {value.toFixed(2)}배
    </span>
  );
}
