"use client";
import { useCallback, useEffect, useState } from "react";
import type { Hook, HookDraft } from "@/lib/schemas";
import { HookLibrary } from "@/components/HookLibrary";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** 라우트가 실패 사유를 본문에 담아 준다. 상태 코드만 보여주면 고칠 방법을 알 수 없다. */
async function failureMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const detail = body && typeof body.error === "string" ? body.error : null;
  return detail ?? `${fallback} (${res.status})`;
}

export default function HooksPage() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/hooks");
    if (!res.ok) throw new Error(await failureMessage(res, "훅을 불러오지 못했습니다"));
    const data = await res.json();
    setHooks(data.hooks ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    reload()
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "훅을 불러오지 못했습니다");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // 저장·토글·삭제는 모두 서버 결과를 다시 읽어 화면을 맞춘다. 낙관적 갱신을 하면
  // 검증에 걸려 저장이 안 된 훅이 화면에만 남는다.
  async function save(draft: HookDraft, id?: string) {
    const res = await fetch(id ? `/api/hooks/${id}` : "/api/hooks", {
      method: id ? "PATCH" : "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(draft),
    });
    if (!res.ok) throw new Error(await failureMessage(res, "훅을 저장하지 못했습니다"));
    setError(null);
    await reload();
  }

  async function toggleFavorite(id: string, next: boolean) {
    const res = await fetch(`/api/hooks/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ isFavorite: next }),
    });
    if (!res.ok) {
      setError(await failureMessage(res, "즐겨찾기를 바꾸지 못했습니다"));
      return;
    }
    setError(null);
    await reload();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/hooks/${id}`, { method: "DELETE", headers: JSON_HEADERS });
    if (!res.ok) {
      setError(await failureMessage(res, "훅을 삭제하지 못했습니다"));
      return;
    }
    setError(null);
    await reload();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">훅</h1>
        <p className="text-sm text-neutral-600">잘된 릴스의 훅을 모아두는 보관함입니다.</p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-band-weak-soft px-3 py-2 text-sm text-band-weak">
          {error}
        </p>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <HookLibrary
          hooks={hooks}
          onSave={save}
          onToggleFavorite={toggleFavorite}
          onDelete={remove}
        />
      )}
    </main>
  );
}
