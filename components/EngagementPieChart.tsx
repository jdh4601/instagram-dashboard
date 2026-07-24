"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PieChartIcon } from "lucide-react";
import type { Reel } from "@/lib/schemas";
import { engagementBreakdown, type EngagementKey } from "@/lib/analysis/engagementBreakdown";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui";

interface Props {
  reels: Reel[];
}

// 색상은 engagementBreakdown의 키에 1:1 대응 (조각·범례·색 항상 일치)
const COLORS: Record<EngagementKey, string> = {
  shares: "#10b981",
  comments: "#f59e0b",
  saves: "#3b82f6",
  likes: "#f43f5e",
};

export function EngagementPieChart({ reels }: Props) {
  const data = engagementBreakdown(reels);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="인게이지먼트 구성" icon={<PieChartIcon size={16} className="text-brand-600" />} />
        <CardBody>
          <EmptyState
            icon={<PieChartIcon size={26} />}
            title="게시물 데이터가 없습니다"
            hint="동기화 후 인게이지먼트 비율을 확인하세요."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="인게이지먼트 구성" icon={<PieChartIcon size={16} className="text-brand-600" />} />
      <CardBody>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              isAnimationActive={false}
              startAngle={90}
              endAngle={-270}
              label={({ percent }) =>
                (percent ?? 0) >= 0.06 ? `${Math.round((percent ?? 0) * 100)}%` : ""
              }
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, n, item) => [
                `${Number(v ?? 0).toLocaleString()} (${Math.round(item?.payload?.pct ?? 0)}%)`,
                n,
              ]}
              contentStyle={{ borderRadius: 8, border: "1px solid #e9edf3", fontSize: 12 }}
            />
            <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
