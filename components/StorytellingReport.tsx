import { Check, X, Sparkles, AlertTriangle } from "lucide-react";
import {
  PRINCIPLE_LABELS,
  type FormatConfidence,
  type PrincipleScore,
  type ReelStoryFormat,
  type StoryBeat,
} from "@/lib/schemas";
import { getStoryFormat, type StoryBeatSpec, type StoryFormatSpec } from "@/lib/analysis/storyFormats";
import { cn } from "@/components/ui";

const CONFIDENCE_LABELS: Record<FormatConfidence, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const CONFIDENCE_CLASSES: Record<FormatConfidence, string> = {
  high: "bg-band-strong-soft text-band-strong",
  medium: "bg-band-ok-soft text-band-ok",
  low: "bg-band-weak-soft text-band-weak",
};

/** 1~5점을 밴드 색으로 옮긴다. 3점은 중간이라 경고색을 쓰지 않는다. */
function scoreClass(score: number): string {
  if (score <= 2) return "bg-band-weak";
  if (score === 3) return "bg-band-ok";
  return "bg-band-strong";
}

function beatTime(beat: StoryBeat): string | null {
  if (beat.startSec == null) return null;
  return beat.endSec != null ? `${beat.startSec}-${beat.endSec}s` : `${beat.startSec}s`;
}

interface Props {
  story: ReelStoryFormat;
  principles: PrincipleScore[];
}

export function StorytellingReport({ story, principles }: Props) {
  const format = getStoryFormat(story.formatId);
  // 카탈로그에 없는 포맷은 저장 시점에 걸러지지만, 화면이 통째로 죽지는 않게 한다.
  if (!format) {
    return (
      <p className="text-sm text-band-weak">
        알 수 없는 포맷입니다({story.formatId}). 다시 분석해 주세요.
      </p>
    );
  }

  // 카탈로그 순서로 그린다. 모델이 순서를 흐트러뜨려도 대본의 흐름은 유지돼야 한다.
  const ordered = format.beats
    .map((spec) => ({ spec, beat: story.beats.find((b) => b.beatId === spec.id) ?? null }))
    .filter((row) => row.beat !== null) as Array<{ spec: StoryBeatSpec; beat: StoryBeat }>;
  const missing = ordered.filter((row) => !row.beat.present);

  return (
    <div className="space-y-6">
      <FormatHeader story={story} format={format} />

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          비트 대조 {missing.length > 0 && `· 빠진 비트 ${missing.length}개`}
        </h4>
        <ol className="space-y-2">
          {ordered.map(({ spec, beat }) => (
            <BeatRow key={spec.id} spec={spec} beat={beat} />
          ))}
        </ol>
      </section>

      <SecretSauce story={story} />

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          8가지 스크립트 원리
        </h4>
        <div className="space-y-2">
          {principles.map((principle) => (
            <PrincipleRow key={principle.id} principle={principle} />
          ))}
        </div>
      </section>
    </div>
  );
}

function FormatHeader({ story, format }: { story: ReelStoryFormat; format: StoryFormatSpec }) {
  const alternate = story.alternateFormatId ? getStoryFormat(story.alternateFormatId) : null;

  return (
    <section className="space-y-2 rounded-lg bg-surface-muted/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-900">{format.label}</span>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium",
            CONFIDENCE_CLASSES[story.confidence],
          )}
        >
          확신 {CONFIDENCE_LABELS[story.confidence]}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-neutral-700">{story.rationale}</p>
      {alternate && (
        <p className="text-xs text-neutral-500">차선 후보: {alternate.label}</p>
      )}
    </section>
  );
}

function BeatRow({ spec, beat }: { spec: StoryBeatSpec; beat: StoryBeat }) {
  const time = beatTime(beat);

  return (
    <li
      className={cn(
        "rounded-lg border p-3",
        beat.present
          ? "border-border-subtle bg-surface"
          : "border-band-weak-border bg-band-weak-soft",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
            beat.present ? "bg-band-strong-soft text-band-strong" : "bg-band-weak text-white",
          )}
        >
          {beat.present ? <Check size={12} /> : <X size={12} />}
        </span>
        <span className="text-sm font-medium text-neutral-900">{spec.label}</span>
        {time && <span className="text-xs tabular-nums text-neutral-400">{time}</span>}
        {!beat.present && (
          <span className="rounded-md bg-band-weak px-1.5 py-0.5 text-[11px] font-medium text-white">
            없음
          </span>
        )}
        {spec.optional && !beat.present && (
          <span className="text-[11px] text-neutral-400">선택 비트</span>
        )}
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">{beat.summary}</p>

      {beat.present && beat.quote && (
        <p className="mt-1 text-xs italic text-neutral-500">&ldquo;{beat.quote}&rdquo;</p>
      )}

      {/* 빠진 비트에만 템플릿을 단다. 있는 비트에 붙이면 읽을 것만 늘어난다. */}
      {!beat.present && (
        <div className="mt-2 space-y-1 border-t border-band-weak-border pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            이 자리에 들어갈 문장
          </p>
          {spec.templates.map((template) => (
            <p key={template} className="text-xs leading-relaxed text-neutral-600">
              {template}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}

function SecretSauce({ story }: { story: ReelStoryFormat }) {
  return (
    <section className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg border border-band-strong-border bg-band-strong-soft p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-band-strong">
          <Sparkles size={13} aria-hidden />
          지킨 것
        </p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700">{story.secretSauceMet}</p>
      </div>
      <div className="rounded-lg border border-band-ok-border bg-band-ok-soft p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-band-ok">
          <AlertTriangle size={13} aria-hidden />
          놓친 것
        </p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700">{story.secretSauceMissed}</p>
      </div>
    </section>
  );
}

function PrincipleRow({ principle }: { principle: PrincipleScore }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-neutral-900">
          {PRINCIPLE_LABELS[principle.id]}
        </span>
        <div
          className="ml-auto flex shrink-0 items-center gap-0.5"
          role="img"
          aria-label={`5점 만점에 ${principle.score}점`}
        >
          {[1, 2, 3, 4, 5].map((step) => (
            <span
              key={step}
              className={cn(
                "h-1.5 w-5 rounded-full",
                step <= principle.score ? scoreClass(principle.score) : "bg-surface-muted",
              )}
            />
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">{principle.evidence}</p>
      <p className="mt-1 text-xs leading-relaxed text-brand-600">→ {principle.fix}</p>
    </div>
  );
}
