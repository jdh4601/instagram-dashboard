"use client";
import { useCallback, useEffect, useState } from "react";
import type { SavedStoryFormat } from "@/lib/schemas";
import { SavedStoryFormatList } from "@/components/SavedStoryFormatList";
import { Skeleton } from "@/components/ui";

/** 라우트가 실패 사유를 본문에 담아 준다. 상태 코드만 보여주면 고칠 방법을 알 수 없다. */
async function failureMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const detail = body && typeof body.error === "string" ? body.error : null;
  return detail ?? `${fallback} (${res.status})`;
}

/**
 * 저장소에서 읽어 온 포맷 판정을 목록에 넘긴다.
 *
 * 삭제 뒤에는 서버 목록을 다시 읽는다. 낙관적 갱신을 하면 실제로는 지워지지 않은
 * 항목이 화면에서만 사라진다.
 */
export function SavedStoryFormatLibrary() {
  const [items, setItems] = useState<SavedStoryFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/story-formats");
    if (!res.ok) throw new Error(await failureMessage(res, "저장한 포맷을 불러오지 못했습니다"));
    const data = (await res.json()) as { storyFormats?: SavedStoryFormat[] };
    setItems(data.storyFormats ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    reload()
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "저장한 포맷을 불러오지 못했습니다");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function remove(id: string) {
    const res = await fetch(`/api/story-formats/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      setError(await failureMessage(res, "저장한 포맷을 지우지 못했습니다"));
      return;
    }
    setError(null);
    await reload();
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-neutral-900">내 보관함</h2>
        <span className="text-xs text-neutral-500">
          릴스 분석에서 담아 둔 포맷 {items.length}건
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-band-weak-soft px-3 py-2 text-sm text-band-weak">
          {error}
        </p>
      )}

      {loading ? <Skeleton className="h-24 w-full" /> : (
        <SavedStoryFormatList items={items} onDelete={remove} />
      )}
    </section>
  );
}
