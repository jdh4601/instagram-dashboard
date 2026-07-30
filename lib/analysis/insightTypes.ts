type InsightSource = "API" | "derived";
type InsightTone = "strength" | "opportunity" | "info";

export interface MetricInsight {
  id: string;
  title: string;
  detail: string;
  tone: InsightTone;
  source: InsightSource;
  currentValue?: number;
  benchmarkValue?: number;
}
