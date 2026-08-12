"use client";
import { useState } from "react";
import { Film, Download, Loader2 } from "lucide-react";
import type { Reel } from "@/lib/schemas";

interface Props {
  reel: Reel;
  onDownloaded: () => void;
}

/**
 * 세로형 릴스 플레이어.
 *
 * 소스는 인스타 CDN이 아니라 로컬 캐시(/api/reels/:id/video)다. Graph가 주는
 * media_url은 수명이 짧아서 화면에 그대로 걸면 잠시 뒤 재생이 끊긴다.
 */
export function ReelVideoPlayer({ reel, onDownloaded }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reels/${reel.id}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `영상을 받지 못했습니다 (${res.status})`);
        return;
      }
      onDownloaded();
    } catch {
      setError("네트워크 오류로 영상을 받지 못했습니다");
    } finally {
      setDownloading(false);
    }
  }

  return (
    // lg 미만에서는 그리드가 한 열로 접혀 영상이 본문 폭을 통째로 먹는다. 9:16이라
    // 폭이 커지면 높이가 그 1.8배로 뛰어 화면을 다 차지하고 분석 패널이 밀려난다.
    // lg에서 쓰는 열 너비(16rem)를 모든 폭의 상한으로 못 박는다.
    <div className="w-full max-w-[16rem] space-y-2">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-card border border-border-subtle bg-neutral-900">
        {reel.videoFile ? (
          // key를 파일명으로 두면 새로 받았을 때 <video>가 예전 소스를 붙들지 않는다.
          <video
            key={reel.videoFile}
            controls
            playsInline
            preload="metadata"
            poster={reel.thumbnailUrl}
            className="h-full w-full"
          >
            <source src={`/api/reels/${reel.id}/video`} type="video/mp4" />
          </video>
        ) : reel.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reel.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-60" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-600">
            <Film size={28} />
          </div>
        )}
      </div>

      {!reel.videoFile && (
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <Download size={15} aria-hidden />
          )}
          {downloading ? "받는 중…" : "영상 받기"}
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm text-band-weak">
          {error}
        </p>
      )}
    </div>
  );
}
