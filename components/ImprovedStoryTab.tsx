"use client";
import { Loader2, Wand2 } from "lucide-react";
import type { ImprovedBeat, ImprovedStory } from "@/lib/schemas";
import { getStoryFormat, getBeatSpec } from "@/lib/analysis/storyFormats";
import { getHookTypeSpec } from "@/lib/analysis/hookCatalog";
import { improvedStoryToScript } from "@/lib/analysis/improvedStoryScript";
import { CopyButton, EmptyState, cn } from "@/components/ui";

/** 원본 대비 이 칸이 어디서 왔는지. 색으로 갈라야 무엇이 바뀌었는지 한눈에 잡힌다. */
const ORIGIN_LABELS: Record<ImprovedBeat["origin"], string> = {
  kept: "그대로",
  rewritten: "고쳐 씀",
  added: "새로 넣음",
};

const ORIGIN_CLASSES: Record<ImprovedBeat["origin"], string> = {
  kept: "bg-surface-muted text-neutral-600",
  rewritten: "bg-band-ok-soft text-band-ok",
  added: "bg-band-strong-soft text-band-strong",
};

interface Props {
  improved: ImprovedStory | null;
  busy: boolean;
  onGenerate: () => void;
}

export function ImprovedStoryTab({ improved, busy, onGenerate }: Props) {
  if (!improved) {
    return (
      <div className="space-y-3">
        <EmptyState
          icon={<Wand2 size={26} />}
          title="아직 전개안이 없습니다"
          hint="분석이 짚은 빠진 비트를 이 릴스의 실제 내용으로 채우고, 순서와 분량을 다시 나눈 전개안을 만듭니다."
        />
        <div className="flex justify-center">
          <GenerateButton busy={busy} onGenerate={onGenerate} label="전개안 생성" />
        </div>
      </div>
    );
  }

  const format = getStoryFormat(improved.formatId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">개선된 전개</h3>
        {format && (
          <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-neutral-600">
            {format.label} 유지
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <CopyButton text={improvedStoryToScript(improved)} />
          <GenerateButton busy={busy} onGenerate={onGenerate} label="다시 생성" subtle />
        </div>
      </div>

      <p className="rounded-lg border border-border-subtle bg-surface-muted/50 p-3 text-sm leading-relaxed text-neutral-700">
        {improved.premise}
      </p>

      <ol className="space-y-2">
        {improved.beats.map((beat, index) => (
          <BeatRow
            key={`${beat.beatId}-${index}`}
            beat={beat}
            formatId={improved.formatId}
            hookType={index === 0 ? improved.hookType : null}
          />
        ))}
      </ol>
    </div>
  );
}

function GenerateButton({
  busy,
  onGenerate,
  label,
  subtle,
}: {
  busy: boolean;
  onGenerate: () => void;
  label: string;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={busy}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60",
        subtle
          ? "text-brand-600 hover:bg-surface-muted"
          : "bg-brand-600 text-white hover:bg-brand-700",
      )}
    >
      {busy ? (
        <Loader2 size={15} className="animate-spin" aria-hidden />
      ) : (
        <Wand2 size={15} aria-hidden />
      )}
      {busy ? "생성 중…" : label}
    </button>
  );
}

/**
 * 첫 비트는 포맷이 뭐라 부르든(출발점·도입…) 실제로는 이 영상의 훅이다.
 * "후킹"으로 부르고 어떤 유형인지까지 붙여야, 3초를 무엇으로 잡는지가 잡힌다.
 */
function BeatRow({
  beat,
  formatId,
  hookType,
}: {
  beat: ImprovedBeat;
  formatId: string;
  hookType: ImprovedStory["hookType"] | null;
}) {
  const spec = getBeatSpec(formatId, beat.beatId);
  const label = hookType ? "후킹" : (spec?.label ?? beat.beatId);
  const hookLabel = hookType ? (getHookTypeSpec(hookType)?.label ?? hookType) : null;

  return (
    <li className="rounded-lg border border-border-subtle bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-neutral-900">{label}</span>
        {hookLabel && (
          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">
            {hookLabel}
          </span>
        )}
        <span className="text-xs tabular-nums text-neutral-400">
          {beat.startSec}-{beat.endSec}s
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            ORIGIN_CLASSES[beat.origin],
          )}
        >
          {ORIGIN_LABELS[beat.origin]}
        </span>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-neutral-800">{beat.line}</p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{beat.note}</p>
    </li>
  );
}
