"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CarouselSlide } from "@/lib/graph/map";
import { Card, cn } from "@/components/ui";

interface Props {
  reelId: string;
  /** 저장된 첫 장. 낱장 조회가 끝나기 전과 실패했을 때 이 한 장으로 버틴다. */
  thumbnailUrl?: string;
}

/**
 * 캐러셀 낱장 뷰어.
 *
 * 저장소에는 첫 장 썸네일만 있다. 나머지 낱장은 서명이 만료되는 CDN 주소라 저장하지
 * 않고, 이 화면을 열 때 /api/reels/:id/children으로 그 시점의 주소를 받아 온다.
 */
export function CarouselGallery({ reelId, thumbnailUrl }: Props) {
  const fallback: CarouselSlide[] = thumbnailUrl
    ? [{ id: "thumbnail", kind: "IMAGE", url: thumbnailUrl }]
    : [];
  const [slides, setSlides] = useState<CarouselSlide[]>(fallback);
  const [index, setIndex] = useState(0);
  // 낱장 조회 실패는 조용히 넘기지 않는다 — 첫 장만 뜨는 이유를 알 수 있어야 한다.
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reels/${reelId}/children`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "낱장을 불러오지 못했습니다");
        return;
      }
      const next = (body.slides ?? []) as CarouselSlide[];
      // 빈 응답에 첫 장 썸네일까지 날리면 화면이 통째로 비어 버린다.
      if (next.length > 0) {
        setSlides(next);
        setIndex(0);
      }
    } catch {
      setError("낱장을 불러오는 중 네트워크 오류가 났습니다");
    } finally {
      setLoading(false);
    }
  }, [reelId]);

  useEffect(() => {
    load();
  }, [load]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, slides.length - 1));
      setIndex(clamped);
      const track = trackRef.current;
      if (track) track.scrollTo({ left: track.clientWidth * clamped, behavior: "smooth" });
    },
    [slides.length],
  );

  const total = slides.length;
  const current = Math.min(index, Math.max(total - 1, 0));

  return (
    <Card className="overflow-hidden">
      {total === 0 ? (
        <div className="flex aspect-[4/5] items-center justify-center bg-surface-muted text-sm text-neutral-500">
          {loading ? "낱장을 불러오는 중입니다" : "보여줄 이미지가 없습니다"}
        </div>
      ) : (
        <div
          role="group"
          aria-roledescription="캐러셀"
          aria-label="게시물 사진"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") goTo(current - 1);
            if (event.key === "ArrowRight") goTo(current + 1);
          }}
          className="relative bg-neutral-950/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
        >
          {/* 손가락으로 넘기는 길과 버튼으로 넘기는 길을 한 트랙에 묶는다. */}
          <div
            ref={trackRef}
            onScroll={(event) => {
              const track = event.currentTarget;
              if (track.clientWidth > 0) setIndex(Math.round(track.scrollLeft / track.clientWidth));
            }}
            className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slides.map((slide) => (
              <div key={slide.id} className="aspect-[4/5] w-full shrink-0 snap-center">
                {slide.kind === "VIDEO" ? (
                  <video
                    src={slide.url}
                    poster={slide.posterUrl}
                    controls
                    playsInline
                    className="h-full w-full object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slide.url} alt="" className="h-full w-full object-contain" />
                )}
              </div>
            ))}
          </div>

          {total > 1 && (
            <>
              {/* 몇 장짜리인지는 사진 위에 얹는다 — 카드 머리글을 두면 그만큼 사진이 준다. */}
              <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-neutral-950/55 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
                {current + 1} / {total}
              </span>
              <NavButton side="left" disabled={current === 0} onClick={() => goTo(current - 1)} />
              <NavButton
                side="right"
                disabled={current === total - 1}
                onClick={() => goTo(current + 1)}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {slides.map((slide, i) => (
                  <span
                    key={slide.id}
                    className={cn(
                      "size-1.5 rounded-full transition-colors",
                      i === current ? "bg-white" : "bg-white/40",
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle bg-surface-muted/50 px-4 py-2 text-xs text-neutral-500">
          <span>{error} — 첫 장만 보여주는 중입니다.</span>
          <button
            type="button"
            onClick={load}
            className="rounded-md px-1.5 py-0.5 font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            다시 시도
          </button>
        </div>
      )}
    </Card>
  );
}

function NavButton({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "이전 장" : "다음 장"}
      className={cn(
        "absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-950/45 text-white transition-opacity hover:bg-neutral-950/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-0",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {side === "left" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}
