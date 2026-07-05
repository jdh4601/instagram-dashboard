import { Info, Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import type { MetricInsight } from "@/lib/analysis/insightTypes";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

const toneStyles = {
  strength: "border-band-strong-border bg-band-strong-soft/70",
  opportunity: "border-band-weak-border bg-band-weak-soft/70",
  info: "border-border-subtle bg-surface-muted/70",
};

interface InsightListProps {
  title: string;
  insights: MetricInsight[];
  helpText?: string;
}

export function InsightList({ title, insights, helpText }: InsightListProps) {
  if (insights.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-1.5">
            {title}
            {helpText && <InsightHelp text={helpText} />}
          </span>
        }
        icon={<Lightbulb size={16} className="text-brand-600" />}
      />
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

function InsightHelp({ text }: { text: string }) {
  return (
    <span className="group/info relative inline-flex">
      <button
        type="button"
        aria-label={`인사이트 산정 기준: ${text}`}
        className="inline-flex size-4 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-surface-muted hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Info size={13} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] -translate-x-24 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs font-normal leading-relaxed text-neutral-600 opacity-0 shadow-card-hover transition-opacity group-hover/info:opacity-100 group-focus-within/info:opacity-100 sm:-translate-x-1/2"
      >
        {text}
      </span>
    </span>
  );
}
