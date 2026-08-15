"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { readNdjson } from "@/lib/ui/ndjsonStream";

export function ReelBreakdownRerunButton({ hookId }: { hookId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function rerun() {
    setRunning(true);
    setPercent(1);
    setMessage("해체를 준비하는 중");
    setError(null);
    try {
      const response = await fetch(`/api/hooks/${hookId}/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `요청이 실패했습니다 (${response.status})`);
      }
      let completed = false;
      for await (const event of readNdjson(response.body)) {
        const parsed = event as { type?: string; percent?: number; message?: string; error?: string };
        if (parsed.type === "progress") {
          setPercent(Number(parsed.percent));
          setMessage(String(parsed.message));
        } else if (parsed.type === "error") {
          throw new Error(parsed.error ?? "릴스 해체에 실패했습니다");
        } else if (parsed.type === "result") {
          completed = true;
        }
      }
      if (!completed) throw new Error("릴스 해체 응답이 끝까지 오지 않았습니다");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "릴스 해체에 실패했습니다");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={rerun}
        disabled={running}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 text-sm font-semibold text-neutral-700 shadow-card hover:bg-surface-muted disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        {running ? (
          <LoaderCircle size={16} className="animate-spin" aria-hidden />
        ) : (
          <RefreshCw size={16} aria-hidden />
        )}
        {running ? `${percent}%` : "다시 해체하기"}
      </button>
      {running && <p role="status" className="text-xs text-brand-700">{message}</p>}
      {error && <p role="alert" className="max-w-sm text-right text-xs text-band-weak">{error}</p>}
    </div>
  );
}
