"use client";
import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";

export interface SyncToast {
  tone: "success" | "warning" | "error";
  message: string;
}

interface DashboardToastProps {
  toast: SyncToast;
  onDismiss: () => void;
}

const TONE_STYLES: Record<SyncToast["tone"], string> = {
  success: "border-band-strong-border bg-band-strong-soft text-band-strong",
  warning: "border-band-ok-border bg-band-ok-soft text-band-ok",
  error: "border-band-weak-border bg-band-weak-soft text-band-weak",
};

function ToneIcon({ tone }: { tone: SyncToast["tone"] }) {
  if (tone === "success") return <CheckCircle2 size={17} className="shrink-0" />;
  if (tone === "warning") return <AlertTriangle size={17} className="shrink-0" />;
  return <XCircle size={17} className="shrink-0" />;
}

export function DashboardToast({ toast, onDismiss }: DashboardToastProps) {
  return (
    <div
      role={toast.tone === "success" ? "status" : "alert"}
      aria-live={toast.tone === "success" ? "polite" : "assertive"}
      aria-atomic="true"
      className={`fixed bottom-4 left-4 right-4 z-30 flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-card-hover sm:left-1/2 sm:right-auto sm:max-w-xl sm:-translate-x-1/2 ${TONE_STYLES[toast.tone]}`}
    >
      <ToneIcon tone={toast.tone} />
      <span className="min-w-0 flex-1">{toast.message}</span>
      {/* 성공은 자동으로 사라지므로 닫기 버튼이 필요 없다. */}
      {toast.tone !== "success" && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="알림 닫기"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
