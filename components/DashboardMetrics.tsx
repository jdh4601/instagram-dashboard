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
  ReferenceDot,
  BarChart,
  Cell,
} from "recharts";
import {
  Clock,
  Gauge,
  SkipForward,
  UserPlus,
  UserCircle,
  TrendingUp,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardBody, EmptyState, Stat } from "@/components/ui";
import { fmtPct, fmtSec, fmtCount } from "@/lib/ui/format";
import { BENCHMARKS } from "@/config/benchmarks";
import type { DashboardMetrics as Metrics } from "@/lib/analysis/dashboardMetrics";

interface Props {
  metrics: Metrics;
}

export function DashboardMetrics({ metrics }: Props) {
  const { series, highSkipReels, topFollowConversionReels } = metrics;

  return (
    <section className="space-y-5">
      <DashboardMetricsKpiCards metrics={metrics} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <WatchTimeCompletionChart series={series} />
        <Retention3sChart series={series} lowRetentionReels={highSkipReels} />
        <FollowConversionRankChart reels={topFollowConversionReels} />
        <ProfileVisitRateChart series={series} />
      </div>
    </section>
  );
}

function DashboardMetricsKpiCards({ metrics }: Props) {
  const completionHint =
    metrics.completionRate === null
      ? "일부 릴스의 영상 길이를 몰라 평균 시청 비율에서 제외됐어요"
      : undefined;

  const watchTimeHint =
    metrics.avgWatchTimeSec === null || metrics.avgDurationSec === null
      ? "영상 길이를 몰라 비교가 어려워요 — 업로드 시 길이를 입력해 주세요"
      : `${Math.round(metrics.avgDurationSec)}초 영상 중 평균 ${fmtSec(metrics.avgWatchTimeSec)} 시청`;

  const skipHint =
    metrics.skipRate === null
      ? "스크린샷을 업로드하면 채워져요"
      : `${100 - BENCHMARKS.hookRetention3s.weakBelow}% 초과 이탈 심함`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat
        label="평균 시청 시간"
        value={metrics.avgWatchTimeSec === null ? "-" : fmtSec(metrics.avgWatchTimeSec)}
        icon={<Clock size={16} />}
        hint={watchTimeHint}
      />
      <Stat
        label="평균 시청 비율"
        value={metrics.completionRate === null ? "-" : fmtPct(metrics.completionRate)}
        icon={<Gauge size={16} />}
        hint={completionHint}
      />
      <Stat
        label="Skip Rate"
        value={metrics.skipRate === null ? "-" : fmtPct(metrics.skipRate)}
        icon={<SkipForward size={16} />}
        hint={skipHint}
      />
      <Stat
        label="팔로우 전환율"
        value={
          metrics.followConversionRate === null ? "-" : fmtPct(metrics.followConversionRate)
        }
        icon={<UserPlus size={16} />}
        hint="follows / reach"
      />
      <Stat
        label="프로필 방문률"
        value={metrics.profileVisitRate === null ? "-" : fmtPct(metrics.profileVisitRate)}
        icon={<UserCircle size={16} />}
        hint="시청 → 팔로우 중간 단계"
      />
    </div>
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
  lowRetentionReels,
}: {
  series: Metrics["series"];
  lowRetentionReels: Metrics["highSkipReels"];
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
            hint="첫 3초 잔존율(=100−스킵)입니다. Graph API 또는 EDIT 인사이트 데이터가 있을 때 표시됩니다."
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="retentionTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "#94a3b8" }} />
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
                {lowRetentionReels.map((r) => (
                  <ReferenceDot
                    key={r.idx}
                    x={r.idx}
                    y={100 - r.skipRate}
                    r={5}
                    fill="#dc2626"
                    stroke="#fff"
                    strokeWidth={2}
                    label={{ value: "이탈", position: "top", fontSize: 10, fill: "#dc2626" }}
                  />
                ))}
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

            {lowRetentionReels.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-1 text-xs font-medium text-band-weak">
                  <AlertTriangle size={12} />
                  훅 이탈이 심한 릴스
                </div>
                <ul className="space-y-1">
                  {lowRetentionReels.slice(0, 3).map((r) => (
                    <li
                      key={r.idx}
                      className="flex items-center justify-between rounded-md border border-band-weak-border bg-band-weak-soft px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate pr-2">{r.title}</span>
                      <span className="shrink-0 tabular-nums font-medium">
                        {fmtPct(100 - r.skipRate)} 잔존
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function FollowConversionRankChart({
  reels,
}: {
  reels: Metrics["topFollowConversionReels"];
}) {
  const data = [...reels].reverse(); // 하→상 순으로 그리기

  return (
    <Card>
      <CardHeader
        title="팔로우 전환율 TOP5"
        icon={<UserPlus size={16} className="text-brand-600" />}
      />
      <CardBody>
        {reels.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={26} />}
            title="팔로우 데이터가 없습니다"
            hint="릴스에 followsFromReel이 등록되면 순위가 표시됩니다."
          />
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis
                  type="category"
                  dataKey="title"
                  width={120}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval={0}
                />
                <Tooltip
                  formatter={(v, _name, entry) => {
                    const e = entry?.payload as Metrics["topFollowConversionReels"][number];
                    return [`${fmtPct(Number(v))} · ${fmtCount(e.follows)}팔로우 · 도달 ${fmtCount(e.reach)}`, "전환율"];
                  }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e9edf3", fontSize: 12 }}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={i === data.length - 1 ? "#4f46e5" : "#818cf8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <ul className="space-y-1">
              {reels.map((r, i) => (
                <li
                  key={r.idx}
                  className="flex items-center justify-between rounded-md border border-slate-100 px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-5 text-center font-medium text-slate-500">{i + 1}</span>
                    <span className="truncate">{r.title}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {fmtPct(r.rate)} · {fmtCount(r.follows)}팔로우
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ProfileVisitRateChart({
  series,
}: {
  series: Metrics["series"];
}) {
  const data = series.map((s) => ({ ...s, rate: s.profileVisitRate }));

  return (
    <Card>
      <CardHeader
        title="프로필 방문률 추이"
        icon={<UserCircle size={16} className="text-brand-600" />}
      />
      <CardBody>
        {series.length < 2 ? (
          <EmptyState
            icon={<UserCircle size={26} />}
            title="릴스 2개 이상부터 표시됩니다"
            hint="릴스에 profileVisits이 등록되면 추이가 표시됩니다."
          />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="visitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis unit="%" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip
                formatter={(v) => [fmtPct(Number(v)), "프로필 방문률"]}
                labelFormatter={(l, p) => {
                  const d = (p?.[0]?.payload ?? {}) as { title?: string; postedAt?: string };
                  return d.title ? `${d.title} · ${d.postedAt ?? ""}` : `${l}번째 릴스`;
                }}
                contentStyle={{ borderRadius: 8, border: "1px solid #e9edf3", fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#visitFill)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
