"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceArea,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { TrendingDown, Activity } from "lucide-react";
import type { RetentionPoint } from "@/lib/schemas";
import type { DropSegment } from "@/lib/analysis/dropDetection";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui";

interface Props {
  curve: RetentionPoint[];
  drops: DropSegment[];
  /** true면 API skip rate 기반 2점 추정 곡선(실측 스크린샷 없음) */
  estimated?: boolean;
}

export function RetentionChart({ curve, drops, estimated = false }: Props) {
  return (
    <Card>
      <CardHeader title="잔존 곡선 + 텐션 저하" icon={<Activity size={16} className="text-brand-600" />} />
      <CardBody>
        {curve.length === 0 ? (
          <EmptyState
            icon={<Activity size={26} />}
            title="잔존 곡선 데이터가 없습니다"
            hint="EDIT 스크린샷을 업로드하면 실측 곡선이, API skip rate가 있으면 3초 훅 추정 곡선이 그려집니다."
          />
        ) : (
          <>
            {estimated && (
              <p className="mb-2 inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-1 text-[11px] text-neutral-500">
                추정 · 3초 훅 기준 (API skip rate) — 초당 실측 곡선은 스크린샷 업로드 시 표시
              </p>
            )}
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={curve} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="sec" unit="s" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip
                  formatter={(v) => [`${v}%`, "잔존"]}
                  labelFormatter={(l) => `${l}초`}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e9edf3", fontSize: 12 }}
                />
                {drops.map((d, i) => (
                  <ReferenceArea key={i} x1={d.startSec} x2={d.endSec} fill="#dc2626" fillOpacity={0.1} />
                ))}
                <Area type="monotone" dataKey="pct" stroke="#4f46e5" strokeWidth={2} fill="url(#retentionFill)" />
              </AreaChart>
            </ResponsiveContainer>
            {drops.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {drops.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-band-weak-border bg-band-weak-soft px-3 py-2 text-sm"
                  >
                    <TrendingDown size={15} className="mt-0.5 shrink-0 text-band-weak" />
                    <span>
                      <b className="text-band-weak">
                        {d.startSec}~{d.endSec}초
                      </b>{" "}
                      <span className="text-neutral-700">{Math.round(d.dropPct)}%p 이탈</span>
                      {d.lines.length > 0 && (
                        <span className="text-neutral-500"> — “{d.lines.map((l) => l.text).join(" ")}”</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
