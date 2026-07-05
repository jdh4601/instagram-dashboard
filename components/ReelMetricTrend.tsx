"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import type { ReelMetricSnapshot } from "@/lib/schemas";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui";
import { fmtCount } from "@/lib/ui/format";

export function ReelMetricTrend({ history }: { history: ReelMetricSnapshot[] }) {
  const first = history[0];
  const latest = history[history.length - 1];
  const extraChanges = first && latest ? [
    change("재시청", first.replays, latest.replays),
    change("팔로우", first.followsFromReel, latest.followsFromReel),
    change("프로필 방문", first.profileVisits, latest.profileVisits),
    change("총 시청 시간", first.totalWatchTimeSec, latest.totalWatchTimeSec, "초"),
  ].filter((item): item is { label: string; value: string } => item !== null) : [];
  return (
    <Card>
      <CardHeader title="조회수 추이" icon={<TrendingUp size={16} className="text-brand-600" />} />
      <CardBody>
        {history.length < 2 ? (
          <EmptyState
            icon={<TrendingUp size={26} />}
            title="추이는 동기화 2회 이상부터 표시됩니다"
            hint="동기화할 때마다 이 릴스의 조회수·도달이 누적됩니다(오늘부터 기록)."
          />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => fmtCount(Number(v))} />
              <Tooltip
                formatter={(v, name) => [Number(v).toLocaleString(), name === "views" ? "조회수" : "도달"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e9edf3", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="reach" stroke="#16a34a" strokeWidth={2} fill="url(#reachFill)" />
              <Area type="monotone" dataKey="views" stroke="#4f46e5" strokeWidth={2} fill="url(#viewsFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {history.length >= 2 && extraChanges.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-subtle pt-4 sm:grid-cols-4">
            {extraChanges.map((item) => (
              <div key={item.label} className="rounded-lg bg-surface-muted p-2.5">
                <p className="text-[11px] text-neutral-500">기간 중 {item.label}</p>
                <p className="mt-0.5 font-semibold tabular-nums text-neutral-800">{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function change(label: string, first: number | undefined, latest: number | undefined, unit = ""): { label: string; value: string } | null {
  if (first === undefined || latest === undefined) return null;
  const delta = latest - first;
  return { label, value: `${delta >= 0 ? "+" : ""}${fmtCount(delta)}${unit}` };
}
