import { Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import type { MetricInsight } from "@/lib/analysis/insightTypes";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

const toneStyles = {
  strength: "border-band-strong-border bg-band-strong-soft/70",
  opportunity: "border-band-weak-border bg-band-weak-soft/70",
  info: "border-border-subtle bg-surface-muted/70",
};

export function InsightList({ title, insights }: { title: string; insights: MetricInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <Card>
      <CardHeader title={title} icon={<Lightbulb size={16} className="text-brand-600" />} />
      <CardBody className={`grid gap-3 ${insights.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {insights.map((insight) => (
          <div key={insight.id} className={`rounded-lg border p-3 ${toneStyles[insight.tone]}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
                {insight.tone === "strength" ? <TrendingUp size={14} /> : insight.tone === "opportunity" ? <TrendingDown size={14} /> : null}
                {insight.title}
              </p>
              <Badge className="shrink-0 text-[10px]">{insight.source}</Badge>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">{insight.detail}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
