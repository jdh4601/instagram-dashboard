import Link from "next/link";
import type {
  AdEfficiencyRow,
  AdEfficiencySort,
  AdEfficiencyTotals,
  AdResultGroup,
} from "@/lib/analysis/adEfficiency";
import { AD_RESULT_LABELS, type AdResultType } from "@/lib/schemas";
import { detailPathForMedia } from "@/lib/ui/navigation";
import { fmtCount, fmtPct, fmtWon } from "@/lib/ui/format";

interface Props {
  groups: AdResultGroup[];
  sort: AdEfficiencySort;
  onSort: (sort: AdEfficiencySort) => void;
}

/** 계산할 수 없는 칸. 0으로 채우면 "0원에 샀다"로 읽혀 판단을 망친다. */
const NONE = "—";

function money(value: number | null): string {
  return value === null ? NONE : fmtWon(value);
}

function rate(value: number | null): string {
  return value === null ? NONE : fmtPct(value);
}

/** 결과 유형을 사람이 읽는 말로. 모르는 유형(Marketing API 성과)은 참여로 잰다. */
function labelOf(type: string | null): string {
  if (type === null) return "참여 (좋아요·저장·댓글·공유)";
  return AD_RESULT_LABELS[type as AdResultType] ?? type;
}

export function AdEfficiencyTable({ groups, sort, onSort }: Props) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <ResultGroup key={group.type ?? "engagement"} group={group} sort={sort} onSort={onSort} />
      ))}
    </div>
  );
}

/**
 * 결과 유형 하나의 표.
 *
 * 유형마다 표를 나누는 이유: 프로필 방문 78건과 링크 클릭 40건은 서로 다른 행동이라
 * 한 표에서 단가로 줄을 세우면 순위가 거짓말이 된다.
 */
function ResultGroup({
  group,
  sort,
  onSort,
}: {
  group: AdResultGroup;
  sort: AdEfficiencySort;
  onSort: (sort: AdEfficiencySort) => void;
}) {
  // 결과 유형이 있는 묶음은 결과 단가로, 없는 묶음(Marketing API)은 참여 단가로 잰다.
  const byEngagement = group.type === null;
  const costKey: AdEfficiencySort = byEngagement ? "costPerEngagement" : "costPerResult";
  const costLabel = byEngagement ? "참여 단가" : "결과 단가";

  return (
    <section aria-label={`${labelOf(group.type)} 광고`}>
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-800">{labelOf(group.type)}</h3>
        <p className="text-xs tabular-nums text-neutral-500">
          {group.totals.postCount}건 · 지출 {fmtWon(group.totals.spend)} ·{" "}
          {costLabel}{" "}
          {money(group.type === null ? group.totals.costPerEngagement : group.totals.costPerResult)}
        </p>
      </header>

      {/* 열이 많아 좁은 화면에서는 표만 가로로 흐른다. 페이지 본문은 넘치지 않는다. */}
      <div className="overflow-x-auto rounded-card border border-border-subtle">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-muted text-left">
              <Th>게시물</Th>
              <Th sortKey="spend" sort={sort} onSort={onSort}>
                지출
              </Th>
              <Th>광고 도달</Th>
              <Th sortKey="cpm" sort={sort} onSort={onSort} hint="노출 1,000회당">
                CPM
              </Th>
              <Th>결과</Th>
              <Th sortKey={costKey} sort={sort} onSort={onSort} hint="1건당 비용">
                {costLabel}
              </Th>
              {/* 광고 반응률과 대비는 광고에 달린 참여를 알아야 나온다. Ad Center
                  기록에는 그 값이 없어 열 자체를 만들지 않는다 — 늘 비어 있는 열은
                  "성과가 없다"로 오독된다. */}
              {byEngagement && <Th hint="광고 도달 대비">광고 반응률</Th>}
              <Th hint="오가닉 도달 대비">오가닉 반응률</Th>
              {byEngagement && (
                <Th sortKey="efficiencyRatio" sort={sort} onSort={onSort} hint="광고÷오가닉">
                  대비
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <Row
                key={`${row.mediaId}-${row.resultType ?? "e"}`}
                row={row}
                byEngagement={byEngagement}
              />
            ))}
          </tbody>
          <Foot totals={group.totals} byEngagement={byEngagement} />
        </table>
      </div>
    </section>
  );
}

function Th({
  children,
  sortKey,
  sort,
  onSort,
  hint,
}: {
  children?: React.ReactNode;
  sortKey?: AdEfficiencySort;
  sort?: AdEfficiencySort;
  onSort?: (sort: AdEfficiencySort) => void;
  hint?: string;
}) {
  return (
    <th className="px-3 py-2 font-medium text-neutral-500">
      {sortKey && onSort ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          aria-pressed={sort === sortKey}
          className={`rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
            sort === sortKey ? "text-brand-600" : "hover:text-neutral-800"
          }`}
        >
          {children}
          {sort === sortKey ? " ▾" : ""}
        </button>
      ) : (
        <span>{children}</span>
      )}
      {hint && <span className="block text-[11px] font-normal text-neutral-400">{hint}</span>}
    </th>
  );
}

function Row({ row, byEngagement }: { row: AdEfficiencyRow; byEngagement: boolean }) {
  const resultValue = row.resultCount ?? row.adEngagements;
  const cost = byEngagement ? row.costPerEngagement : row.costPerResult;

  return (
    <tr className="border-b border-border-subtle last:border-0">
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
      <td className="px-3 py-2 tabular-nums text-neutral-700">{resultValue.toLocaleString()}</td>
      <td className="px-3 py-2 font-semibold tabular-nums text-neutral-900">{money(cost)}</td>
      {byEngagement && (
        <td className="px-3 py-2 tabular-nums text-neutral-700">{rate(row.adEngagementRate)}</td>
      )}
      <td className="px-3 py-2 tabular-nums text-neutral-500">
        {rate(row.organicEngagementRate)}
      </td>
      {byEngagement && (
        <td className="px-3 py-2">
          <Ratio value={row.efficiencyRatio} />
        </td>
      )}
    </tr>
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

function Foot({ totals, byEngagement }: { totals: AdEfficiencyTotals; byEngagement: boolean }) {
  return (
    <tfoot>
      <tr className="border-t-2 border-border-subtle bg-surface-muted font-semibold">
        <td className="px-3 py-2 text-neutral-500">합계 · {totals.postCount}건</td>
        <td className="px-3 py-2 tabular-nums text-neutral-900">{fmtWon(totals.spend)}</td>
        <td className="px-3 py-2 tabular-nums text-neutral-700">{fmtCount(totals.adReach)}</td>
        <td className="px-3 py-2 tabular-nums text-neutral-700">{money(totals.cpm)}</td>
        <td className="px-3 py-2 tabular-nums text-neutral-700">
          {(byEngagement ? totals.adEngagements : totals.resultCount).toLocaleString()}
        </td>
        <td className="px-3 py-2 tabular-nums text-neutral-900">
          {money(byEngagement ? totals.costPerEngagement : totals.costPerResult)}
        </td>
        <td className="px-3 py-2" colSpan={byEngagement ? 3 : 1} />
      </tr>
    </tfoot>
  );
}
