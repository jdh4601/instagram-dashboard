import Link from "next/link";
import { Film, GalleryHorizontalEnd, ImageOff } from "lucide-react";
import type {
  AdEfficiencyRow,
  AdEfficiencySort,
  AdEfficiencyTotals,
} from "@/lib/analysis/adEfficiency";
import { AD_RESULT_LABELS, type AdResultType, type MediaKind } from "@/lib/schemas";
import { detailPathForMedia } from "@/lib/ui/navigation";
import { fmtCount, fmtPct, fmtWon } from "@/lib/ui/format";

interface Props {
  rows: AdEfficiencyRow[];
  totals: AdEfficiencyTotals;
  sort: AdEfficiencySort;
  onSort: (sort: AdEfficiencySort) => void;
  /** 결과 유형이 섞여 있으면 단가 열에 경고를 붙인다. */
  mixedResultTypes: boolean;
}

/** 계산할 수 없는 칸. 0으로 채우면 "0원에 샀다"로 읽혀 판단을 망친다. */
const NONE = "—";

function money(value: number | null): string {
  return value === null ? NONE : fmtWon(value);
}

function rate(value: number | null): string {
  return value === null ? NONE : fmtPct(value);
}

function resultLabel(type: string | null): string {
  if (type === null) return "참여";
  return AD_RESULT_LABELS[type as AdResultType] ?? type;
}

export function AdEfficiencyTable({ rows, totals, sort, onSort, mixedResultTypes }: Props) {
  return (
    // 열이 많아 좁은 화면에서는 표만 가로로 흐른다. 페이지 본문은 넘치지 않는다.
    <div className="overflow-x-auto rounded-card border border-border-subtle">
      <table className="w-full min-w-[58rem] text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-surface-muted text-left">
            <Th>게시물</Th>
            <Th sortKey="spend" sort={sort} onSort={onSort}>
              지출
            </Th>
            <Th sortKey="adReach" sort={sort} onSort={onSort}>
              광고 도달
            </Th>
            <Th sortKey="cpm" sort={sort} onSort={onSort} hint="노출 1,000회당">
              CPM
            </Th>
            <Th hint="부스트 목표 달성 수">결과</Th>
            <Th
              sortKey="costPerResult"
              sort={sort}
              onSort={onSort}
              hint={mixedResultTypes ? "⚠ 유형이 섞임" : "1건당 비용"}
            >
              결과 단가
            </Th>
            <Th sortKey="resultRate" sort={sort} onSort={onSort} hint="광고 도달 100명당">
              결과율
            </Th>
            <Th hint="오가닉 도달 대비">오가닉 반응률</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={`${row.mediaId}-${row.resultType ?? "e"}`} row={row} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border-subtle bg-surface-muted font-semibold">
            <td className="px-3 py-2 text-neutral-500">합계 · {totals.postCount}건</td>
            <td className="px-3 py-2 tabular-nums text-neutral-900">{fmtWon(totals.spend)}</td>
            <td className="px-3 py-2 tabular-nums text-neutral-700">{fmtCount(totals.adReach)}</td>
            <td className="px-3 py-2 tabular-nums text-neutral-700">{money(totals.cpm)}</td>
            <td className="px-3 py-2 tabular-nums text-neutral-700">
              {totals.resultCount.toLocaleString()}
            </td>
            {/* 유형이 섞인 합계 단가는 서로 다른 행동을 한 분모에 넣은 값이라 내지 않는다. */}
            <td className="px-3 py-2 tabular-nums text-neutral-900">
              {mixedResultTypes ? NONE : money(totals.costPerResult)}
            </td>
            <td className="px-3 py-2" colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
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
  const active = sortKey !== undefined && sort === sortKey;
  return (
    <th className="whitespace-nowrap px-3 py-2 font-medium text-neutral-500">
      {sortKey && onSort ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          aria-pressed={active}
          className={`rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
            active ? "text-brand-600" : "hover:text-neutral-800"
          }`}
        >
          {children}
          {active ? " ▾" : ""}
        </button>
      ) : (
        <span>{children}</span>
      )}
      {hint && <span className="block text-[11px] font-normal text-neutral-400">{hint}</span>}
    </th>
  );
}

function Row({ row }: { row: AdEfficiencyRow }) {
  return (
    <tr className="border-b border-border-subtle last:border-0 hover:bg-surface-muted/50">
      <td className="px-3 py-2">
        <Link
          href={detailPathForMedia(row.mediaType, row.mediaId)}
          className="group flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Thumbnail url={row.thumbnailUrl} kind={row.mediaType} />
          <span className="min-w-0">
            <span className="block max-w-56 truncate font-medium text-neutral-900 group-hover:text-brand-600">
              {row.caption?.trim() || "(캡션 없음)"}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-400">
              <KindBadge kind={row.mediaType} />
              {row.postedAt.slice(0, 10)}
              {row.adCount > 1 ? ` · 광고 ${row.adCount}건` : ""}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 font-semibold tabular-nums text-neutral-900">
        {fmtWon(row.spend)}
      </td>
      <td className="px-3 py-2 tabular-nums text-neutral-700">{fmtCount(row.adReach)}</td>
      <td className="px-3 py-2 tabular-nums text-neutral-700">{money(row.cpm)}</td>
      <td className="px-3 py-2">
        <span className="tabular-nums text-neutral-700">
          {(row.resultCount ?? row.adEngagements).toLocaleString()}
        </span>
        {/* 유형을 값 옆에 붙여 둔다 — 어떤 행동을 센 수인지 모르면 단가를 읽을 수 없다. */}
        <span className="mt-0.5 block text-[11px] text-neutral-400">
          {resultLabel(row.resultType)}
        </span>
      </td>
      <td className="px-3 py-2 font-semibold tabular-nums text-neutral-900">
        {money(row.resultType === null ? row.costPerEngagement : row.costPerResult)}
      </td>
      <td className="px-3 py-2 tabular-nums text-neutral-700">
        {rate(row.resultRate ?? row.adEngagementRate)}
      </td>
      <td className="px-3 py-2 tabular-nums text-neutral-500">{rate(row.organicEngagementRate)}</td>
    </tr>
  );
}

/**
 * 표지 사진. 인스타 CDN 주소라 next/image로 감싸지 않는다 — 도메인 허용 목록을
 * 사람이 손으로 관리하게 되고, 서명이 만료되면 어차피 깨진다.
 */
function Thumbnail({ url, kind }: { url?: string; kind: MediaKind }) {
  const shape = kind === "REELS" ? "aspect-[9/16] w-8" : "aspect-square w-11";
  if (!url) {
    return (
      <span
        className={`flex ${shape} shrink-0 items-center justify-center rounded-md bg-surface-muted text-neutral-300`}
      >
        <ImageOff size={14} aria-hidden />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={`${shape} shrink-0 rounded-md object-cover`}
    />
  );
}

function KindBadge({ kind }: { kind: MediaKind }) {
  const reels = kind === "REELS";
  const Icon = reels ? Film : GalleryHorizontalEnd;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">
      <Icon size={11} aria-hidden />
      {reels ? "릴스" : "캐러셀"}
    </span>
  );
}
