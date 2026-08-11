"use client";
import { useState } from "react";
import { Mic, FlaskConical, KeyRound, LayoutList, Loader2 } from "lucide-react";
import type { Reel, ReelAnalysis } from "@/lib/schemas";
import {
  REEL_ANALYSIS_TABS,
  DEFAULT_TAB_ID,
  tabNeedsLlmAnalysis,
  type ReelAnalysisTabId,
} from "@/lib/ui/reelAnalysisTabs";
import { CopyButton, EmptyState, cn } from "@/components/ui";
import { StorytellingReport } from "@/components/StorytellingReport";

const TAB_ICONS: Record<ReelAnalysisTabId, typeof Mic> = {
  transcript: Mic,
  idea: FlaskConical,
  hook: KeyRound,
  story: LayoutList,
};

const HOOK_TYPE_LABELS: Record<string, string> = {
  problem: "문제 제기",
  contrarian: "역발상",
  "personal-experience": "경험담",
  curiosity: "호기심",
  "result-proof": "결과 증명",
  "how-to": "방법 제시",
  other: "기타",
};

interface Props {
  reel: Reel;
  analysis: ReelAnalysis | null;
  onAnalyze: () => Promise<void>;
  onTranscribe: () => Promise<void>;
}

function countWords(reel: Reel): number {
  return (reel.transcript ?? []).reduce(
    (total, line) => total + line.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-sm leading-relaxed text-neutral-700">{value}</p>
    </div>
  );
}

export function ReelAnalysisPanel({ reel, analysis, onAnalyze, onTranscribe }: Props) {
  const [tab, setTab] = useState<ReelAnalysisTabId>(DEFAULT_TAB_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = reel.transcript ?? [];
  const hasTranscript = lines.length > 0;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      {/* 분석 실행은 탭 안이 아니라 머리말에 둔다. 기본 탭이 Transcript라
          탭 안에 숨기면 분석을 돌리려고 탭을 먼저 옮겨야 한다. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {analysis && (
            <>
              <h2 className="text-sm font-semibold text-neutral-900">Summary</h2>
              <p className="text-sm leading-relaxed text-neutral-700">{analysis.summary}</p>
            </>
          )}
        </div>
        {hasTranscript && (
          <AnalyzePrompt busy={busy} onAnalyze={() => run(onAnalyze)} regenerate={analysis != null} />
        )}
      </div>

      <div
        role="tablist"
        aria-label="릴스 분석"
        className="flex gap-1 overflow-x-auto rounded-card border border-border-subtle bg-surface p-1"
      >
        {REEL_ANALYSIS_TABS.map((item) => {
          const Icon = TAB_ICONS[item.id];
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-neutral-600 hover:bg-surface-muted hover:text-neutral-900",
              )}
            >
              <Icon size={15} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-band-weak-soft px-3 py-2 text-sm text-band-weak">
          {error}
        </p>
      )}

      <div
        role="tabpanel"
        className="space-y-4 rounded-card border border-border-subtle bg-surface p-4"
      >
        {tab === "transcript" ? (
          <TranscriptTab
            reel={reel}
            busy={busy}
            onTranscribe={() => run(onTranscribe)}
            hasTranscript={hasTranscript}
          />
        ) : !hasTranscript ? (
          <EmptyState
            title="자막이 없어 분석할 수 없습니다"
            hint="Transcript 탭에서 자동 전사를 먼저 돌려 주세요."
          />
        ) : !analysis ? (
          <EmptyState
            title="아직 분석하지 않았습니다"
            hint="위 분석하기를 누르면 자막을 바탕으로 아이디어·훅·이야기 구조를 한 번에 뽑습니다."
          />
        ) : (
          <>
            {tab === "idea" && <IdeaTab analysis={analysis} />}
            {tab === "hook" && <HookTab analysis={analysis} />}
            {tab === "story" && <StoryTab analysis={analysis} />}
          </>
        )}
      </div>
    </section>
  );
}

function AnalyzePrompt({
  busy,
  onAnalyze,
  regenerate,
}: {
  busy: boolean;
  onAnalyze: () => void;
  regenerate: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onAnalyze}
      disabled={busy}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60",
        regenerate
          ? "text-neutral-600 hover:bg-surface-muted"
          : "bg-brand-600 text-white hover:bg-brand-700",
      )}
    >
      {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
      {regenerate ? "다시 분석" : "분석하기"}
    </button>
  );
}

function TranscriptTab({
  reel,
  busy,
  hasTranscript,
  onTranscribe,
}: {
  reel: Reel;
  busy: boolean;
  hasTranscript: boolean;
  onTranscribe: () => void;
}) {
  const lines = reel.transcript ?? [];
  const fullText = lines.map((line) => line.text).join("\n");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">Transcript</h3>
        {hasTranscript && (
          <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-neutral-600">
            {countWords(reel)} 단어
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {hasTranscript && <CopyButton text={fullText} />}
          <button
            type="button"
            onClick={onTranscribe}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-brand-600 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
            자동 전사
          </button>
        </div>
      </div>

      {hasTranscript ? (
        <div className="space-y-1.5">
          {lines.map((line, index) => (
            <p key={`${line.startSec}-${index}`} className="text-sm italic leading-relaxed text-neutral-600">
              {line.text}
            </p>
          ))}
        </div>
      ) : (
        <EmptyState
          title="아직 자막이 없습니다"
          hint="영상을 먼저 받은 뒤 자동 전사를 누르면 자막이 채워집니다."
        />
      )}
    </div>
  );
}

function IdeaTab({ analysis }: { analysis: ReelAnalysis }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="핵심 아이디어" value={analysis.idea.coreIdea} />
      <Field label="가치 제안" value={analysis.idea.valueProposition} />
      <Field label="타깃" value={analysis.idea.targetAudience} />
      <Field label="차별점" value={analysis.idea.differentiator} />
    </div>
  );
}

function HookTab({ analysis }: { analysis: ReelAnalysis }) {
  const { hook } = analysis;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
          {HOOK_TYPE_LABELS[hook.type] ?? hook.type}
        </span>
      </div>
      <Field label="실제 훅" value={hook.line} />
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          재사용 템플릿
        </p>
        <div className="flex items-start gap-2">
          <p className="flex-1 rounded-lg bg-surface-muted p-3 text-sm font-medium text-neutral-900">
            {hook.template}
          </p>
          <CopyButton text={hook.template} />
        </div>
      </div>
      <Field label="왜 먹히는가" value={hook.why} />
    </div>
  );
}

function StoryTab({ analysis }: { analysis: ReelAnalysis }) {
  return <StorytellingReport story={analysis.story} principles={analysis.principles} />;
}
