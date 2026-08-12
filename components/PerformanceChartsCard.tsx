"use client";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { AccountSnapshot, Reel } from "@/lib/schemas";
import {
  buildPerformanceCharts,
  type FollowerDayPoint,
  type ViewsDayPoint,
} from "@/lib/analysis/performanceCharts";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui";
import { PostedReelsTooltip } from "@/components/charts/PostedReelsTooltip";
import { fmtCount } from "@/lib/ui/format";

// 축·격자 색은 밝은 테마 값만 둔다. 다크는 globals.css의 `.dark .recharts-*`
// 규칙이 덮으므로 여기서 테마를 분기하면 두 곳이 어긋난다.
const AXIS_TICK = { fontSize: 11, fill: "#94a3b8" } as const;
const GRID_STROKE = "#eef2f7";
const TOOLTIP_STYLE = { borderRadius: 8, border: "1px solid #e9edf3", fontSize: 12 } as const;

const VIEWS_COLOR = "#4f46e5";
const FOLLOWER_COLOR = "#16a34a";
/** 이전 기간은 늘 뒤로 물러나야 해서 밝기·채도를 뺀 회색 한 가지로 통일한다. */
const PREVIOUS_COLOR = "#94a3b8";

const CHART_HEIGHT = 200;

/** 축 라벨은 MM-DD로 줄인다. 전체 날짜는 카드 상단 구간 캡션이 책임진다. */
function shortDay(value: string): string {
  return value.slice(5);
}

function lookupPoint<T extends { date: string }>(label: unknown, byDate: Map<string, T>): T | null {
  if (typeof label !== "string") return null;
  return byDate.get(label) ?? null;
}

export function PerformanceChartsCard({
  reels,
  snapshots,
}: {
  reels: Reel[];
  snapshots: AccountSnapshot[];
}) {
  const [comparing, setComparing] = useState(false);
  const chart = useMemo(() => buildPerformanceCharts(reels, snapshots), [reels, snapshots]);
  const viewsByDate = useMemo(
    () => new Map(chart.views.map((point) => [point.date, point])),
    [chart.views],
  );

  // 켤 수 없는 토글은 켜진 상태로 남을 수 없다.
  const showPrevious = comparing && chart.hasPrevious;

  const toggle = (
    <button
      type="button"
      aria-pressed={showPrevious}
      disabled={!chart.hasPrevious}
      onClick={() => setComparing((on) => !on)}
      title={chart.hasPrevious ? undefined : "겹쳐 그릴 이전 기간 데이터가 없습니다"}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-subtle px-2.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${showPrevious ? "bg-neutral-400" : "bg-transparent ring-1 ring-neutral-300"}`}
      />
      {showPrevious ? "이전 기간 겹쳐 보기" : "이전 기간 미표시"}
    </button>
  );

  return (
    <Card>
      <CardHeader
        title="Performance charts"
        icon={<BarChart3 size={16} className="text-brand-600" />}
        action={toggle}
      />
      <CardBody>
        {chart.range === null ? (
          <EmptyState
            icon={<BarChart3 size={26} />}
            title="아직 데이터가 없습니다"
            hint="동기화하면 성과 차트가 그려집니다."
          />
        ) : (
          <>
            <p className="tabular-nums text-xs text-neutral-500">
              {chart.range.start} ~ {chart.range.end} ({chart.range.days}일)
              {showPrevious && chart.previousRange !== null && (
                <span className="ml-2 text-neutral-400">
                  이전 기간 {chart.previousRange.start} ~ {chart.previousRange.end}
                </span>
              )}
            </p>

            <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ChartPanel
                id="perf-chart-views-by-day"
                title="Views by day"
                caption="게시일 기준 · 그날 올린 게시물의 조회수 합"
                hasData={chart.hasViews}
                emptyHint="게시물을 동기화하면 게시일 기준 조회수가 쌓입니다."
              >
                <ViewsByDayChart
                  points={chart.views}
                  byDate={viewsByDate}
                  showPrevious={showPrevious}
                />
              </ChartPanel>

              <ChartPanel
                id="perf-chart-cumulative-views"
                title="Cumulative views"
                caption="구간 시작부터의 누적 · 쉰 날은 평평하다"
                hasData={chart.hasViews}
                emptyHint="게시물을 동기화하면 누적 조회수가 그려집니다."
              >
                <CumulativeViewsChart points={chart.views} showPrevious={showPrevious} />
              </ChartPanel>

              <ChartPanel
                id="perf-chart-followers-gained"
                title="Followers gained by day"
                caption="연속한 팔로워 스냅샷의 차이"
                hasData={chart.hasFollowerGain}
                emptyHint="팔로워 스냅샷이 2건 이상이어야 증감을 계산할 수 있습니다."
              >
                <FollowersGainedChart points={chart.followers} showPrevious={showPrevious} />
              </ChartPanel>

              <ChartPanel
                id="perf-chart-cumulative-followers"
                title="Cumulative followers"
                caption="팔로워 스냅샷의 절대 수치"
                hasData={chart.hasFollowerTotal}
                emptyHint="동기화로 팔로워 스냅샷이 쌓이면 추이가 그려집니다."
              >
                <CumulativeFollowersChart points={chart.followers} showPrevious={showPrevious} />
              </ChartPanel>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function ChartPanel({
  id,
  title,
  caption,
  hasData,
  emptyHint,
  children,
}: {
  id: string;
  title: string;
  caption: string;
  hasData: boolean;
  emptyHint: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h3 id={id} className="text-sm font-semibold text-neutral-800">
        {title}
      </h3>
      <p className="mt-0.5 text-[11px] text-neutral-500">{caption}</p>
      {hasData ? (
        <div className="mt-2">{children}</div>
      ) : (
        // 빈 축만 남기면 고장으로 읽힌다. 왜 비었는지 말해 준다.
        <EmptyState className="mt-2 py-6" title="아직 데이터가 없습니다" hint={emptyHint} />
      )}
    </section>
  );
}

function ViewsByDayChart({
  points,
  byDate,
  showPrevious,
}: {
  points: ViewsDayPoint[];
  byDate: Map<string, ViewsDayPoint>;
  showPrevious: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={shortDay} />
        <YAxis tick={AXIS_TICK} tickFormatter={(v) => fmtCount(Number(v))} />
        <Tooltip
          cursor={{ fill: "rgba(99,102,241,0.08)" }}
          // 툴팁 안의 원본 링크를 누르려면 포인터 이벤트를 살려야 한다.
          wrapperStyle={{ pointerEvents: "auto" }}
          content={({ label }) => {
            const point = lookupPoint(label, byDate);
            if (point === null) return null;
            return <PostedReelsTooltip point={point} showPrevious={showPrevious} />;
          }}
        />
        {showPrevious && <Bar dataKey="prevViews" name="이전 기간" fill={PREVIOUS_COLOR} fillOpacity={0.45} radius={[3, 3, 0, 0]} />}
        <Bar dataKey="views" name="조회수" fill={VIEWS_COLOR} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CumulativeViewsChart({
  points,
  showPrevious,
}: {
  points: ViewsDayPoint[];
  showPrevious: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={shortDay} />
        <YAxis tick={AXIS_TICK} tickFormatter={(v) => fmtCount(Number(v))} />
        <Tooltip
          formatter={(value, name) => [Number(value).toLocaleString(), name]}
          contentStyle={TOOLTIP_STYLE}
        />
        {showPrevious && (
          <Line
            type="stepAfter"
            dataKey="prevCumulative"
            name="이전 기간"
            stroke={PREVIOUS_COLOR}
            strokeDasharray="4 3"
            strokeWidth={2}
            dot={false}
          />
        )}
        {/* 게시가 없는 날 평평하게 유지되는 계단이 곧 "쉰 날"이다 */}
        <Line type="stepAfter" dataKey="cumulative" name="누적 조회수" stroke={VIEWS_COLOR} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FollowersGainedChart({
  points,
  showPrevious,
}: {
  points: FollowerDayPoint[];
  showPrevious: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={shortDay} />
        <YAxis tick={AXIS_TICK} tickFormatter={(v) => fmtCount(Number(v))} />
        <Tooltip
          cursor={{ fill: "rgba(22,163,74,0.08)" }}
          formatter={(value, name) => [`${Number(value) > 0 ? "+" : ""}${Number(value).toLocaleString()}명`, name]}
          contentStyle={TOOLTIP_STYLE}
        />
        {showPrevious && <Bar dataKey="prevGained" name="이전 기간" fill={PREVIOUS_COLOR} fillOpacity={0.45} radius={[3, 3, 0, 0]} />}
        <Bar dataKey="gained" name="증감" fill={FOLLOWER_COLOR} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CumulativeFollowersChart({
  points,
  showPrevious,
}: {
  points: FollowerDayPoint[];
  showPrevious: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={shortDay} />
        <YAxis domain={["auto", "auto"]} tick={AXIS_TICK} tickFormatter={(v) => fmtCount(Number(v))} />
        <Tooltip
          formatter={(value, name) => [`${Number(value).toLocaleString()}명`, name]}
          contentStyle={TOOLTIP_STYLE}
        />
        {showPrevious && (
          <Line
            type="monotone"
            dataKey="prevTotal"
            name="이전 기간"
            stroke={PREVIOUS_COLOR}
            strokeDasharray="4 3"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        )}
        {/* 스냅샷은 매일 찍히지 않는다. 없는 날을 0으로 채우면 추이가 톱니가 된다. */}
        <Line
          type="monotone"
          dataKey="total"
          name="팔로워"
          stroke={FOLLOWER_COLOR}
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
