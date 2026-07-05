import type { ReactNode } from "react";
import type { Reel } from "@/lib/schemas";
import type { ReelKpiDeltas, ReelKpiKey } from "@/lib/analysis/reelKpiDeltas";
import { fmtCount, fmtDuration } from "@/lib/ui/format";
import { Badge, Card } from "@/components/ui";

interface Metric {
  key: ReelKpiKey;
  label: string;
  value: string;
  note?: ReactNode;
}

export function ReelPerformanceDashboard({ reel, deltas }: { reel: Reel; deltas?: ReelKpiDeltas }) {
  const primary: Metric[] = [
    { key: "views", label: "조회수", value: fmtCount(reel.views) },
    { key: "reach", label: "도달", value: fmtCount(reel.reach), note: "고유 계정" },
    { key: "likes", label: "좋아요", value: fmtCount(reel.likes) },
    { key: "comments", label: "댓글", value: fmtCount(reel.comments) },
    { key: "saves", label: "저장", value: fmtCount(reel.saves) },
    { key: "shares", label: "공유", value: fmtCount(reel.shares) },
  ];

  const secondary = [
    { label: "평균 시청", value: `${reel.avgWatchTimeSec.toFixed(1)}초`, source: "API", delta: deltas?.avgWatchTimeSec },
    typeof reel.totalInteractions === "number" ? { label: "총 상호작용", value: fmtCount(reel.totalInteractions), source: "API" } : null,
    typeof reel.totalWatchTimeSec === "number" ? { label: "총 시청 시간", value: fmtDuration(reel.totalWatchTimeSec), source: "API" } : null,
    typeof reel.skipRate === "number" ? { label: "Skip Rate", value: `${reel.skipRate.toFixed(2)}%`, source: reel.skipRateSource ?? "API" } : null,
    typeof reel.replays === "number" ? { label: "재시청", value: fmtCount(reel.replays), source: "API" } : null,
    typeof reel.profileVisits === "number" ? { label: "프로필 방문", value: fmtCount(reel.profileVisits), source: "API" } : null,
    typeof reel.followsFromReel === "number" ? { label: "팔로우", value: fmtCount(reel.followsFromReel), source: "API" } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <h2 className="text-sm font-semibold text-neutral-800">릴스 성과</h2>
        <Badge className="text-[10px]">Instagram API{reel.skipRateSource === "EDIT" ? " + EDIT" : ""}</Badge>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6">
        {primary.map((metric, index) => (
          <div
            key={metric.key}
            className={`min-w-0 border-border-subtle px-3 py-3 sm:px-4 ${index < primary.length - 1 ? "border-r" : ""} ${index < 3 ? "border-b sm:border-b-0" : ""}`}
          >
            <p className="text-[11px] font-medium text-neutral-500">{metric.label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-900 sm:text-2xl">{metric.value}</p>
            <div className="mt-0.5 min-h-4 text-[10px] leading-4">
              {metric.note ? <span className="text-neutral-400">{metric.note}</span> : <Delta pct={deltas?.[metric.key]} />}
            </div>
          </div>
        ))}
      </div>

      {secondary.length > 0 && (
        <div className="flex flex-wrap border-t border-border-subtle bg-surface-muted/45">
          {secondary.map((metric, index) => (
            <div key={metric.label} className={`min-w-32 flex-1 px-3 py-2.5 sm:px-4 ${index < secondary.length - 1 ? "border-r border-border-subtle" : ""}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-neutral-500">{metric.label}</span>
                <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-400">{metric.source}</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="whitespace-nowrap text-base font-semibold tabular-nums text-neutral-900">{metric.value}</span>
                {"delta" in metric && <Delta pct={metric.delta} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null;
  const rounded = Math.round(pct);
  if (rounded === 0) return <span className="whitespace-nowrap text-neutral-400">평균 수준</span>;
  return (
    <span className={`whitespace-nowrap ${rounded > 0 ? "text-band-strong" : "text-band-weak"}`}>
      평균 대비 {rounded > 0 ? "+" : ""}{rounded}%
    </span>
  );
}
