import { ExternalLink, Film } from "lucide-react";
import type { ViewsDayPoint } from "@/lib/analysis/performanceCharts";

interface PostedReelsTooltipProps {
  point: ViewsDayPoint;
  /** 이전 기간 비교가 켜졌을 때만 그 값을 덧붙인다 */
  showPrevious: boolean;
}

/**
 * 일별 조회수 막대의 툴팁.
 *
 * 막대 하나가 그날 게시한 릴스의 합이라 합계만 보여주면 "어느 릴스가 끌었는지"를
 * 알 수 없다. 그래서 합계 아래에 그날 게시물을 전부 펼친다.
 */
export function PostedReelsTooltip({ point, showPrevious }: PostedReelsTooltipProps) {
  return (
    <div className="max-w-[17rem] rounded-lg border border-border-subtle bg-surface p-2.5 text-xs shadow-card">
      <p className="font-semibold tabular-nums text-neutral-800">{point.date}</p>

      {point.views === null ? (
        <p className="mt-1 text-neutral-500">게시 없음</p>
      ) : (
        <>
          <p className="mt-0.5 tabular-nums text-neutral-600">
            조회수 {point.views.toLocaleString()}회 · 게시 {point.reels.length}건
          </p>
          <ul className="mt-2 space-y-2">
            {point.reels.map((reel) => (
              <li key={reel.id} className="flex items-start gap-2">
                <span className="relative h-11 w-8 shrink-0 overflow-hidden rounded bg-neutral-100">
                  {reel.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={reel.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-neutral-300">
                      <Film size={12} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-neutral-800">{reel.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                    <span className="tabular-nums">{reel.views.toLocaleString()}회</span>
                    {reel.permalink && (
                      <a
                        href={reel.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-brand-600 hover:underline"
                      >
                        원본
                        <ExternalLink size={10} aria-hidden />
                      </a>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {showPrevious && point.prevDate !== null && (
        <p className="mt-2 border-t border-border-subtle pt-1.5 tabular-nums text-neutral-500">
          이전 기간 {point.prevDate} ·{" "}
          {point.prevViews === null ? "게시 없음" : `${point.prevViews.toLocaleString()}회`}
        </p>
      )}
    </div>
  );
}
