import type { Band } from "@/lib/analysis/diagnosis";

// 진단 밴드 → 디자인 토큰 클래스 (globals.css @theme 정의)
const BAND_CLASSES: Record<Band, string> = {
  weak: "text-band-weak bg-band-weak-soft border-band-weak-border",
  ok: "text-band-ok bg-band-ok-soft border-band-ok-border",
  strong: "text-band-strong bg-band-strong-soft border-band-strong-border",
};

export function bandColor(band: Band): string {
  return BAND_CLASSES[band];
}

export function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

// 큰 수를 만 단위로 축약 (10000 → "1만", 12000 → "1.2만")
export function fmtCount(n: number): string {
  if (n < 10000) return n.toLocaleString();
  const man = n / 10000;
  const rounded = Math.round(man * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}만`;
}

export function fmtSec(n: number): string {
  return `${n.toFixed(1)}초`;
}

export function fmtDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return fmtSec(totalSeconds);
  const totalMinutes = totalSeconds / 60;
  if (totalMinutes < 60) return `${totalMinutes.toFixed(1)}분`;
  return `${(totalMinutes / 60).toFixed(1)}시간`;
}
