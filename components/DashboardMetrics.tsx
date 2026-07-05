"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui";
import { fmtPct, fmtSec } from "@/lib/ui/format";
import { BENCHMARKS } from "@/config/benchmarks";
import type { DashboardMetrics as Metrics } from "@/lib/analysis/dashboardMetrics";

interface Props {
  metrics: Metrics;
}

export function DashboardMetrics({ metrics }: Props) {
  const { series } = metrics;

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <WatchTimeCompletionChart series={series} />
        <Retention3sChart series={series} />
      </div>
    </section>
  );
}

function WatchTimeCompletionChart({
  series,
}: {
  series: Metrics["series"];
}) {
  // 평균 시청 비율 데이터가 전혀 없으면 죽은 라인/우측 축을 숨긴다.
  const hasCompletion = series.some((s) => s.completionRate !== null);
  return (
    <Card>
      <CardHeader
        title="시청 시간 / 평균 시청 비율"
        icon={<TrendingUp size={16} className="text-brand-600" />}
      />
      <CardBody>
        {series.length < 2 ? (
          <EmptyState
            icon={<Clock size={26} />}
            title="릴스 2개 이상부터 표시됩니다"
            hint="평균 시청 시간(막대)과 영상 길이 대비 시청 비율(선)을 함께 봅니다."
          />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={series} margin={{ top: 6, right: 16, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="watchFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(v) => `${v}초`}
              />
              {hasCompletion && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  unit="%"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
              )}
              <Tooltip
                formatter={(v, name) => {
                  if (name === "avgWatchTimeSec") return [fmtSec(Number(v)), "평균 시청"];
                  if (name === "completionRate") return [fmtPct(Number(v)), "평균 시청 비율"];
                  return [Number(v), name];
                }}
                labelFormatter={(l, p) => {
                  const d = (p?.[0]?.payload ?? {}) as { title?: string; postedAt?: string };
                  return d.title ? `${d.title} · ${d.postedAt ?? ""}` : `${l}번째 릴스`;
                }}
                contentStyle={{ borderRadius: 8, border: "1px solid #e9edf3", fontSize: 12 }}
              />
              <Bar
                yAxisId="left"
                dataKey="avgWatchTimeSec"
                fill="url(#watchFill)"
                stroke="#4f46e5"
                strokeWidth={1}
                radius={[4, 4, 0, 0]}
              />
              {hasCompletion && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="completionRate"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              )}
              {hasCompletion && (
                <ReferenceLine
                  yAxisId="right"
                  y={BENCHMARKS.completionRate.weakBelow}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  label={{
                    value: "약점",
                    position: "insideBottomRight",
                    fontSize: 10,
                    fill: "#dc2626",
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}

function Retention3sChart({
  series,
}: {
  series: Metrics["series"];
}) {
  // 3초 잔존율 = 100 - skipRate. 결손은 null 유지 → 차트에서 갭으로 그린다(0으로 채우면 거짓 급락).
  const data = series.map((s) => ({
    ...s,
    retention: s.skipRate == null ? null : 100 - s.skipRate,
  }));
  const weakBelow = BENCHMARKS.hookRetention3s.weakBelow;

  return (
    <Card>
      <CardHeader
        title="3초 잔존율 추이"
        icon={<Activity size={16} className="text-brand-600" />}
      />
      <CardBody>
        {series.length < 2 ? (
          <EmptyState
            icon={<Activity size={26} />}
            title="릴스 2개 이상부터 표시됩니다"
            hint="첫 3초 잔존율(=100−스킵)입니다. Graph API의 Skip Rate가 있을 때 표시됩니다."
          />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="retentionTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="idx"
                type="number"
                domain={[7, "dataMax"]}
                allowDataOverflow
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis
                domain={[0, 75]}
                ticks={[0, 25, 50, 75]}
                unit="%"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <Tooltip
                formatter={(v) => [fmtPct(Number(v)), "3초 잔존율"]}
                labelFormatter={(l, p) => {
                  const d = (p?.[0]?.payload ?? {}) as { title?: string; postedAt?: string };
                  return d.title ? `${d.title} · ${d.postedAt ?? ""}` : `${l}번째 릴스`;
                }}
                contentStyle={{ borderRadius: 8, border: "1px solid #e9edf3", fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="retention"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#retentionTrendFill)"
                connectNulls={false}
              />
              <ReferenceLine
                y={weakBelow}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{
                  value: `약점 <${weakBelow}%`,
                  position: "insideBottomRight",
                  fontSize: 10,
                  fill: "#dc2626",
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
