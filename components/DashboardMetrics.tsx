"use client";

import type { ReactNode } from "react";

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

const MIN_CHART_CANVAS_WIDTH = 560;
const CHART_WIDTH_PER_REEL = 48;

// 릴스마다 일정한 가로 공간을 확보해 데이터가 많아져도 압축하지 않는다.
// 카드보다 넓어진 캔버스는 ScrollableChartFrame에서 좌우 스크롤한다.
export function chartCanvasMinWidth(length: number): number {
  return Math.max(MIN_CHART_CANVAS_WIDTH, length * CHART_WIDTH_PER_REEL);
}

export function formatIndexRanges(indexes: number[]): string {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";

  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  const flush = () => ranges.push(start === end ? `${start}` : `${start}–${end}`);

  for (const value of sorted.slice(1)) {
    if (value === end + 1) {
      end = value;
      continue;
    }
    flush();
    start = value;
    end = value;
  }
  flush();
  return ranges.join(", ");
}

// 3초 잔존율 차트의 Y 상한: 데이터 최대값과 약점 기준선 중 큰 쪽 위로
// 10%p 여유를 두고 5 단위로 올림한다(100% 상한). 기준선이 잘리지 않게 한다.
export function retentionYMax(values: number[], weakBelow: number): number {
  const dataMax = values.length > 0 ? Math.max(...values) : 0;
  return Math.min(100, Math.ceil((Math.max(dataMax, weakBelow) + 10) / 5) * 5);
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

function ScrollableChartFrame({
  seriesLength,
  height,
  ariaLabel,
  children,
}: {
  seriesLength: number;
  height: number;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <>
      {seriesLength > 8 && (
        <p className="mb-1 text-right text-[11px] text-neutral-400">
          ← 좌우로 스크롤해 전체 릴스 보기 →
        </p>
      )}
      <div
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className="overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <div
          className="w-full"
          style={{ minWidth: chartCanvasMinWidth(seriesLength), height }}
        >
          {children}
        </div>
      </div>
    </>
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
        title="시청 시간 / 평균 시청 비율 (릴스 기준)"
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
          <ScrollableChartFrame
            seriesLength={series.length}
            height={220}
            ariaLabel="시청 시간과 평균 시청 비율 차트. 좌우로 스크롤해 모든 릴스를 확인할 수 있습니다."
          >
            <ResponsiveContainer width="100%" height="100%">
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
          </ScrollableChartFrame>
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
  // 모든 릴스의 눈금을 유지하고, 넓어진 캔버스를 좌우로 스크롤한다.
  const xTicks = data.map((d) => d.idx);
  const retentionValues = data
    .map((d) => d.retention)
    .filter((v): v is number => v !== null);
  const missingRetentionIndexes = data
    .filter((d) => d.retention === null)
    .map((d) => d.idx);
  const yMax = retentionYMax(retentionValues, weakBelow);

  return (
    <Card>
      <CardHeader
        title="3초 잔존율 추이 (릴스 기준)"
        icon={<Activity size={16} className="text-brand-600" />}
      />
      <CardBody>
        {retentionValues.length < 2 ? (
          <EmptyState
            icon={<Activity size={26} />}
            title="3초 잔존율 데이터가 부족합니다"
            hint="첫 3초 잔존율(=100−스킵)입니다. Graph API의 Skip Rate가 있는 릴스 2개 이상부터 표시됩니다."
          />
        ) : (
          <>
            <ScrollableChartFrame
              seriesLength={data.length}
              height={200}
              ariaLabel="3초 잔존율 추이 차트. 좌우로 스크롤해 모든 릴스를 확인할 수 있습니다."
            >
              <ResponsiveContainer width="100%" height="100%">
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
                  domain={["dataMin", "dataMax"]}
                  ticks={xTicks}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis
                  domain={[0, yMax]}
                  allowDecimals={false}
                  unit="%"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <Tooltip
                  // 세로 위치를 차트 하단으로 고정해 데이터 선을 가리지 않게 한다(x는 커서를 따라감).
                  position={{ y: 150 }}
                  allowEscapeViewBox={{ y: true }}
                  offset={12}
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
                  dot={{ r: 4, fill: "#4f46e5", stroke: "#fff", strokeWidth: 1.5 }}
                  activeDot={{ r: 6 }}
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
            </ScrollableChartFrame>
            {missingRetentionIndexes.length > 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                3초 잔존율 미수집: {formatIndexRanges(missingRetentionIndexes)}번 릴스
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
