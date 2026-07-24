"use client";
import { useRef, useState } from "react";
import { Captions, Upload, ThumbsUp, AlertTriangle, Trash2, Sparkles, Pencil } from "lucide-react";
import type { TranscriptAnalysis } from "@/lib/analysis/transcriptAnalysis";
import type { TranscriptInsights } from "@/lib/schemas";
import { Card, CardHeader, CardBody } from "@/components/ui";

interface Props {
  reelId: string;
  analysis: TranscriptAnalysis;
  insights?: TranscriptInsights; // 캐시된 LLM 심층 분석
  onChange: () => void; // 업로드/삭제 후 상세 데이터 재요청
}

// CapCut에서 내보낸 .srt 자막을 올려 잘된 점/아쉬운 점을 지표와 함께 분석한다.
export function SrtUploadCard({ reelId, analysis, insights, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const hasTranscript = analysis.lineCount > 0;

  async function analyzeWithAi() {
    setAiBusy(true);
    setAiError("");
    try {
      const res = await fetch(`/api/reels/${reelId}/transcript/analyze`, { method: "POST" });
      if (!res.ok) {
        setAiError((await res.json()).error ?? "AI 분석 실패");
        return;
      }
      onChange(); // 캐시된 결과를 상세 재요청으로 반영
    } catch {
      setAiError("네트워크 오류로 분석하지 못했어요.");
    } finally {
      setAiBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".srt")) {
      setError(".srt 파일만 업로드할 수 있어요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const srt = await file.text();
      const res = await fetch(`/api/reels/${reelId}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srt }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "업로드 실패");
        return;
      }
      onChange();
    } catch {
      setError("네트워크 오류로 업로드하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTranscript() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/reels/${reelId}/transcript`, { method: "DELETE" });
      if (!res.ok) {
        setError((await res.json()).error ?? "삭제 실패");
        return;
      }
      onChange();
    } catch {
      setError("네트워크 오류로 삭제하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const strengths = analysis.insights.filter((i) => i.kind === "strength");
  const weaknesses = analysis.insights.filter((i) => i.kind === "weakness");

  return (
    <Card>
      <CardHeader
        title="자막 분석 (SRT)"
        icon={<Captions size={16} className="text-brand-600" />}
        action={
          hasTranscript ? (
            <button
              type="button"
              onClick={removeTranscript}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-neutral-400 hover:text-band-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 sm:min-h-9"
            >
              <Trash2 size={13} /> 자막 삭제
            </button>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        {!hasTranscript ? (
          <>
            <button
              type="button"
              disabled={busy}
              aria-busy={busy}
              aria-describedby="srt-upload-hint"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) uploadFile(file);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-wait ${
                dragOver ? "border-brand-500 bg-brand-50" : "border-border-subtle hover:border-brand-300"
              }`}
            >
              <Upload size={22} className="text-neutral-400" />
              <span className="text-sm font-medium text-neutral-700">
                {busy ? "분석 중…" : "CapCut .srt 자막을 끌어다 놓거나 클릭"}
              </span>
              <span id="srt-upload-hint" className="text-xs text-neutral-500">
                자막을 올리면 훅·CTA·급락 구간을 지표와 함께 분석해 드려요.
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".srt"
              aria-label="SRT 자막 파일 선택"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
                e.target.value = "";
              }}
            />
            {error && <p role="alert" className="text-sm text-band-weak">{error}</p>}
          </>
        ) : (
          <>
            <p className="text-xs text-neutral-500">
              {analysis.coveragePct === null
                ? `자막 ${analysis.lineCount}줄 · 약 ${Math.round(analysis.lastLineSec)}초 분량 (영상 길이 미상 — 동기화 시 보완됩니다)`
                : `자막 ${analysis.lineCount}줄 · 영상의 ${Math.round(analysis.coveragePct)}%를 덮습니다.`}
            </p>
            {error && <p className="text-sm text-band-weak">{error}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InsightColumn
                title="잘된 점"
                items={strengths}
                icon={<ThumbsUp size={15} className="text-band-strong" />}
                tone="border-band-strong-border bg-band-strong-soft"
                emptyCopy="자막에서 뚜렷한 강점은 아직 안 보여요."
              />
              <InsightColumn
                title="아쉬운 점"
                items={weaknesses}
                icon={<AlertTriangle size={15} className="text-band-weak" />}
                tone="border-band-weak-border bg-band-weak-soft"
                emptyCopy="자막 측면의 약점은 없어요."
              />
            </div>

            {/* AI 심층 분석 — 자막 내용 + 지표를 LLM이 함께 보고 원인 진단 */}
            <div className="space-y-3 border-t border-border-subtle pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
                  <Sparkles size={15} className="text-brand-600" /> AI 심층 분석
                </p>
                <button
                  type="button"
                  onClick={analyzeWithAi}
                  disabled={aiBusy}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-card bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 sm:min-h-9"
                >
                  <Sparkles size={13} />
                  {aiBusy ? "분석 중…" : insights ? "다시 분석" : "AI로 분석하기"}
                </button>
              </div>
              {aiError && <p className="text-sm text-band-weak">{aiError}</p>}

              {!insights ? (
                <p className="text-xs text-neutral-500">
                  자막 내용과 조회수·평균시청·스킵률 등 지표를 함께 분석해 원인을 찾아드려요.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="rounded-card bg-surface-muted/60 p-3 text-sm leading-relaxed text-neutral-700">
                    {insights.summary}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <AiColumn
                      title="잘된 점"
                      items={insights.strengths}
                      icon={<ThumbsUp size={15} className="text-band-strong" />}
                      tone="border-band-strong-border bg-band-strong-soft"
                    />
                    <AiColumn
                      title="아쉬운 점"
                      items={insights.weaknesses}
                      icon={<AlertTriangle size={15} className="text-band-weak" />}
                      tone="border-band-weak-border bg-band-weak-soft"
                    />
                  </div>
                  {insights.generatedAt && (
                    <p className="text-[11px] text-neutral-400">
                      {new Date(insights.generatedAt).toLocaleString("ko-KR")} 생성
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

interface AiColumnProps {
  title: string;
  items: TranscriptInsights["strengths"];
  icon: React.ReactNode;
  tone: string;
}

function AiColumn({ title, items, icon, tone }: AiColumnProps) {
  const isEmpty = items.length === 0;
  const boxTone = isEmpty ? "border-neutral-200 bg-neutral-50" : tone;
  return (
    <div className={`rounded-card border p-4 ${boxTone}`}>
      <h3 className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${isEmpty ? "text-neutral-400" : ""}`}>
        {icon}
        {title}
      </h3>
      {isEmpty ? (
        <p className="text-sm text-neutral-400">해당 항목이 없어요.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i}>
              <p className="text-sm font-medium text-neutral-800">{it.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{it.detail}</p>
              {it.rewrite && <RewriteSuggestion text={it.rewrite} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 새 자막 제안은 전체가 아니라 일부(첫 줄 · 약 40자)만 미리보기로 노출한다.
const REWRITE_PREVIEW_MAX = 40;

function previewRewrite(text: string): { preview: string; truncated: boolean } {
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= REWRITE_PREVIEW_MAX && firstLine === text.trim()) {
    return { preview: firstLine, truncated: false };
  }
  const clipped = firstLine.slice(0, REWRITE_PREVIEW_MAX).trim();
  return { preview: clipped, truncated: true };
}

function RewriteSuggestion({ text }: { text: string }) {
  const { preview, truncated } = previewRewrite(text);
  return (
    <div className="mt-1.5 rounded-card border border-brand-200 bg-brand-50/70 px-2.5 py-1.5">
      <p className="flex items-center gap-1 text-[11px] font-semibold text-brand-700">
        <Pencil size={11} /> 이렇게 바꿔보세요
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-neutral-700">
        “{preview}{truncated ? "…" : ""}”
      </p>
    </div>
  );
}

interface ColumnProps {
  title: string;
  items: TranscriptAnalysis["insights"];
  icon: React.ReactNode;
  tone: string;
  emptyCopy: string;
}

function InsightColumn({ title, items, icon, tone, emptyCopy }: ColumnProps) {
  const isEmpty = items.length === 0;
  const boxTone = isEmpty ? "border-neutral-200 bg-neutral-50" : tone;
  return (
    <div className={`rounded-card border p-4 ${boxTone}`}>
      <h3 className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${isEmpty ? "text-neutral-400" : ""}`}>
        {icon}
        {title}
      </h3>
      {isEmpty ? (
        <p className="text-sm text-neutral-400">{emptyCopy}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i}>
              <p className="text-sm font-medium text-neutral-800">{it.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{it.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
