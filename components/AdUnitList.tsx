import Link from "next/link";
import type { AdUnit } from "@/lib/ads/adUnit";
import { adUnitMetrics } from "@/lib/analysis/adUnitMetrics";
import { AdUnitThumbnail } from "@/components/AdUnitThumbnail";
import { adUnitStatus, goalLabel, NONE } from "@/lib/ui/adUnitLabels";
import { Badge, EmptyState } from "@/components/ui";
import { fmtCount, fmtWon } from "@/lib/ui/format";

interface Props {
  units: AdUnit[];
}

/**
 * 광고 한 건이 한 줄인 목록.
 *
 * 아직 안 도는 광고의 지출과 노출을 0으로 그리지 않는다. 심사 중인 광고를 0으로
 * 적으면 "돌았는데 아무도 안 봤다"로 읽혀, 멀쩡한 광고를 죽이는 판단을 부른다.
 */
export function AdUnitList({ units }: Props) {
  if (units.length === 0) {
    return (
      <EmptyState
        title="집행한 광고가 없습니다"
        hint="광고 관리자나 Business Suite의 'Create ad'로 만든 광고가 여기에 잡힙니다. 인스타그램 앱 '홍보하기' 부스트는 Ad Center에만 남아 올라오지 않습니다."
      />
    );
  }

  return (
    // 열이 많아 좁은 화면에서는 표만 가로로 흐른다. 페이지 본문은 넘치지 않는다.
    <div className="overflow-x-auto rounded-card border border-border-subtle">
      <table className="w-full min-w-[48rem] text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-surface-muted text-left">
            <th className="px-3 py-2 font-medium text-neutral-500">광고</th>
            <th className="px-3 py-2 font-medium text-neutral-500">
              조회
              <span className="ml-1 text-xs font-normal text-neutral-400">노출</span>
            </th>
            <th className="px-3 py-2 font-medium text-neutral-500">
              조회자
              <span className="ml-1 text-xs font-normal text-neutral-400">도달</span>
            </th>
            <th className="px-3 py-2 font-medium text-neutral-500">결과</th>
            <th className="px-3 py-2 font-medium text-neutral-500">지출</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <Row key={unit.adId} unit={unit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ unit }: { unit: AdUnit }) {
  const status = adUnitStatus(unit);
  // 아직 성과가 한 줄도 안 온 광고는 숫자 자리를 비워 둔다.
  const metric = (value: number) => (unit.hasDelivery ? fmtCount(value) : NONE);

  // 지출을 노출로 나눈 값이라 지출 칸에 얹는다. 열을 하나 더 내면 좁은 화면에서
  // 표가 그만큼 더 흐르는데, CPM 하나 보자고 치를 값은 아니다.
  const cpm = unit.hasDelivery ? adUnitMetrics(unit).cpm : null;
  const notes: string[] = [];
  if (cpm !== null) notes.push(`CPM ${fmtWon(cpm)}`);
  if (unit.budget) {
    notes.push(`예산 ${fmtWon(unit.budget.amount)}${unit.budget.kind === "DAILY" ? " / 일" : ""}`);
  }

  return (
    <tr className="border-b border-border-subtle last:border-0 hover:bg-surface-muted">
      <td className="px-3 py-2">
        <Link
          href={`/ads/${unit.adId}`}
          className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <AdUnitThumbnail url={unit.thumbnailUrl} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <Badge band={status.band}>{status.label}</Badge>
              {unit.createdAt && (
                <span className="text-xs text-neutral-400">{fmtDate(unit.createdAt)}</span>
              )}
            </span>
            <span className="mt-0.5 line-clamp-1 block max-w-xs font-medium text-neutral-900">
              {unit.name}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 tabular-nums text-neutral-700">{metric(unit.impressions)}</td>
      <td className="px-3 py-2 tabular-nums text-neutral-700">{metric(unit.reach)}</td>
      <td className="px-3 py-2">
        <span className="block tabular-nums text-neutral-700">
          {unit.results ? fmtCount(unit.results.count) : NONE}
        </span>
        <span className="block text-xs text-neutral-400">{goalLabel(unit.goal)}</span>
      </td>
      <td className="px-3 py-2">
        <span className="block tabular-nums text-neutral-700">
          {unit.hasDelivery ? fmtWon(unit.spend) : NONE}
        </span>
        {notes.length > 0 && (
          <span className="block text-xs text-neutral-400">{notes.join(" · ")}</span>
        )}
      </td>
    </tr>
  );
}

function fmtDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
