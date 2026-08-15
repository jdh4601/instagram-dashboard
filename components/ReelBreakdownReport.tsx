import Link from "next/link";
import { ArrowLeft, ExternalLink, Film, Scissors } from "lucide-react";
import type { Hook } from "@/lib/schemas";
import { HOOK_CATEGORY_LABELS } from "@/lib/schemas";
import { BREAKDOWN_HOOK_BY_KEY, BREAKDOWN_HOOK_TAXONOMY } from "@/lib/reelBreakdown/taxonomy";
import { cn } from "@/components/ui";
import { ReelBreakdownRerunButton } from "@/components/ReelBreakdownRerunButton";

const FLOW_COLORS = [
  "bg-neutral-900",
  "bg-neutral-400",
  "bg-slate-600",
  "bg-neutral-300",
  "bg-brand-600",
  "bg-slate-400",
  "bg-band-weak",
  "bg-neutral-700",
  "bg-brand-400",
];

export function formatBreakdownTime(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function assetUrl(hookId: string, kind: "frames" | "clips", file: string): string {
  return `/api/hooks/${encodeURIComponent(hookId)}/breakdown/assets/${kind}/${file}`;
}

export function ReelBreakdownReport({ hook }: { hook: Hook }) {
  const breakdown = hook.breakdown;
  if (!breakdown) return null;
  const hookSpec = BREAKDOWN_HOOK_BY_KEY.get(breakdown.hookType)!;
  const totalBeatSeconds = breakdown.beats.reduce((sum, beat) => sum + beat.end - beat.start, 0);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Link
            href="/hooks"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft size={16} aria-hidden />
            훅 저장소로
          </Link>
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
              <Scissors size={14} aria-hidden />
              Reel breakdown
            </div>
            <h1 className="max-w-3xl text-2xl font-bold leading-snug text-neutral-900 sm:text-3xl">
              {hook.text}
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              {new Date(breakdown.generatedAt).toLocaleString("ko-KR")} 해체 완료
            </p>
          </div>
        </div>
        <ReelBreakdownRerunButton hookId={hook.id} />
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <article className="rounded-card border border-border-subtle bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Film size={17} className="text-brand-600" aria-hidden />
              원본과 저장 분류
            </div>
            <a
              href={breakdown.reelUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-500"
            >
              원본 열기 <ExternalLink size={14} aria-hidden />
            </a>
          </div>
          <div className="mt-4 flex gap-4">
            {hook.thumbnailUrl && (
              // Instagram CDN은 주소가 수시로 바뀌므로 next/image 도메인 목록에 묶지 않는다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hook.thumbnailUrl}
                alt=""
                className="aspect-[9/16] w-24 shrink-0 rounded-lg object-cover"
              />
            )}
            <dl className="min-w-0 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-neutral-400">내가 저장한 유형</dt>
                <dd className="mt-1 font-semibold text-neutral-800">
                  {HOOK_CATEGORY_LABELS[hook.category]}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-400">영상에서 분류한 도입</dt>
                <dd className="mt-1 font-semibold text-brand-700">{hookSpec.ko}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-400">길이 · 구조</dt>
                <dd className="mt-1 text-neutral-700">
                  {formatBreakdownTime(breakdown.durationSec)} · {breakdown.beats.length}개 구간
                </dd>
              </div>
            </dl>
          </div>
        </article>

        <article className="rounded-card border border-border-subtle bg-surface p-5 shadow-card">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">전체 흐름</h2>
            <span className="font-mono text-xs text-neutral-400">
              총 {formatBreakdownTime(breakdown.durationSec)}
            </span>
          </div>
          <div className="mt-4 flex h-9 gap-0.5 overflow-hidden rounded-md" aria-hidden>
            {breakdown.beats.map((beat, index) => (
              <span
                key={`${beat.start}-${beat.end}`}
                className={FLOW_COLORS[index]}
                style={{ flexGrow: beat.end - beat.start, flexBasis: 0 }}
              />
            ))}
          </div>
          <ol className="mt-4 grid gap-x-5 sm:grid-cols-2">
            {breakdown.beats.map((beat, index) => (
              <li
                key={`${beat.label}-${beat.start}`}
                className="grid grid-cols-[0.5rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border-subtle py-2 text-xs"
              >
                <span className={cn("h-2 w-2 rounded-sm", FLOW_COLORS[index])} aria-hidden />
                <span className="truncate font-semibold text-neutral-700">{beat.label}</span>
                <time className="font-mono text-neutral-400">
                  {formatBreakdownTime(beat.start)}–{formatBreakdownTime(beat.end)}
                </time>
              </li>
            ))}
          </ol>
          <span className="sr-only">총 분석 구간 {totalBeatSeconds.toFixed(1)}초</span>
        </article>
      </section>

      <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-bold text-neutral-900">훅 유형</h2>
          <span className="font-mono text-sm text-neutral-400">{hookSpec.en}</span>
        </div>
        <p className="mt-3 text-xl font-bold text-neutral-900">{hookSpec.ko}</p>
        <p className="mt-1 text-sm text-neutral-500">{hookSpec.desc}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {BREAKDOWN_HOOK_TAXONOMY.map((spec) => (
            <span
              key={spec.key}
              title={spec.desc}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs",
                spec.key === breakdown.hookType
                  ? "border-brand-600 bg-brand-600 font-semibold text-white"
                  : "border-border-subtle text-neutral-500",
              )}
            >
              {spec.ko}
            </span>
          ))}
        </div>
      </section>

      <section aria-labelledby="beat-title" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="beat-title" className="text-xl font-bold text-neutral-900">장면별 대본 구조</h2>
          <span className="text-xs text-neutral-400">각 영상은 해당 구간만 재생합니다</span>
        </div>
        <ol className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card">
          {breakdown.beats.map((beat, index) => {
            const clip = assetUrl(hook.id, "clips", beat.clipFile);
            const poster = assetUrl(hook.id, "frames", beat.posterFile);
            return (
              <li
                key={`${beat.start}-${beat.label}`}
                className="grid gap-5 p-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:p-5 lg:grid-cols-[11rem_minmax(0,1fr)]"
              >
                <figure className="mx-auto w-full max-w-44 sm:mx-0">
                  <video
                    controls
                    playsInline
                    preload="none"
                    poster={poster}
                    aria-label={`${formatBreakdownTime(beat.start)}부터 ${beat.scene}`}
                    className="aspect-[9/16] w-full rounded-lg bg-neutral-950 object-cover"
                  >
                    <source src={clip} type="video/mp4" />
                  </video>
                  <figcaption className="mt-2 text-xs leading-relaxed text-neutral-500">
                    {beat.scene}
                  </figcaption>
                </figure>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <time className="font-mono text-xs text-neutral-400">
                      {formatBreakdownTime(beat.start)}–{formatBreakdownTime(beat.end)}
                    </time>
                    <span
                      className={cn(
                        "rounded px-2 py-1 text-xs font-bold text-white",
                        index === 0 || index === breakdown.beats.length - 1
                          ? "bg-brand-600"
                          : "bg-neutral-900",
                      )}
                    >
                      {beat.label}
                    </span>
                  </div>
                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-600">대사</p>
                    <p className="mt-2 text-base leading-7 text-neutral-900 sm:text-lg">
                      {beat.translation}
                    </p>
                  </div>
                  <div className="mt-5 border-t border-border-subtle pt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">원문</p>
                    <p className="mt-2 font-serif text-sm leading-6 text-neutral-600 sm:text-base">
                      {beat.original}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
