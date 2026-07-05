export type InsightSource = "API" | "derived" | "EDIT";
export type InsightTone = "strength" | "opportunity" | "info";

export interface MetricInsight {
  id: string;
  title: string;
  detail: string;
  tone: InsightTone;
  source: InsightSource;
  currentValue?: number;
  benchmarkValue?: number;
}
