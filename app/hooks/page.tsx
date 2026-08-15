"use client";
import { useCallback, useEffect, useState } from "react";
import type { Hook, HookDraft, Reel } from "@/lib/schemas";
import { groupHookExamplesByType, type HookExamplesByType } from "@/lib/ui/hookExamples";
import { HookLibrary } from "@/components/HookLibrary";
import { HookCatalog } from "@/components/HookCatalog";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { readNdjson } from "@/lib/ui/ndjsonStream";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** 라우트가 실패 사유를 본문에 담아 준다. 상태 코드만 보여주면 고칠 방법을 알 수 없다. */
async function failureMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const detail = body && typeof body.error === "string" ? body.error : null;
  return detail ?? `${fallback} (${res.status})`;
}

export default function HooksPage() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [examples, setExamples] = useState<HookExamplesByType | undefined>();
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

  // 카탈로그의 "내 릴스에서 나온 사례"용. 이미 분석된 릴스의 훅을 그대로 다시 쓴다.
  // 실패해도 보관함과 카탈로그 본문은 멀쩡해야 하므로 에러 배너를 띄우지 않고
  // 사례 없이 내려간다 — 부가 정보 하나 때문에 페이지 전체가 실패로 보이면 곤란하다.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/reels")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { reels?: Reel[] } | null) => {
        if (cancelled || !data) return;
        setExamples(groupHookExamplesByType(data.reels ?? []));
      })
      .catch(() => {
        if (!cancelled) setExamples(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function breakdown(
    id: string,
    onProgress: (progress: { percent: number; message: string }) => void,
  ) {
    const res = await fetch(`/api/hooks/${id}/breakdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    });
    if (!res.ok || !res.body) {
      throw new Error(await failureMessage(res, "릴스를 해체하지 못했습니다"));
    }

    let completed = false;
    for await (const event of readNdjson(res.body)) {
      const parsed = event as { type?: string; percent?: number; message?: string; error?: string };
      if (parsed.type === "progress") {
        onProgress({ percent: Number(parsed.percent), message: String(parsed.message) });
      } else if (parsed.type === "error") {
        throw new Error(parsed.error ?? "릴스 해체에 실패했습니다");
      } else if (parsed.type === "result") {
        completed = true;
      }
    }
    if (!completed) throw new Error("릴스 해체 응답이 끝까지 오지 않았습니다");
    await reload();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">훅 저장소</h1>
        <p className="text-sm text-neutral-600">
          잘된 릴스의 훅을 모아두는 보관함과, 유형·원리를 찾아보는 카탈로그입니다.
        </p>
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
          onBreakdown={breakdown}
        />
      )}

      {/* 보관함이 로딩 중이어도 카탈로그는 정적 상수라 바로 읽을 수 있다. */}
      <HookCatalog examples={examples} />
    </main>
  );
}
