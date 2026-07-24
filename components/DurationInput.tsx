"use client";
import { useState } from "react";
import { Timer } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { fmtPct } from "@/lib/ui/format";

interface Props {
  reelId: string;
  /** 저장된 영상 길이(초). 0이면 아직 입력 전이다. */
  durationSec: number;
  /** Graph API가 준 평균 시청 시간(초). 완료율 미리보기에 쓴다. */
  avgWatchTimeSec: number;
  onChange: () => void; // 저장 후 상세 데이터 재요청
}

export function DurationInput({ reelId, durationSec, avgWatchTimeSec, onChange }: Props) {
  const [value, setValue] = useState(durationSec > 0 ? String(durationSec) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const preview = valid && avgWatchTimeSec > 0 ? (avgWatchTimeSec / parsed) * 100 : null;

  async function save() {
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/reels/${reelId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ durationSec: parsed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "저장하지 못했습니다");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="영상 길이"
        icon={<Timer size={16} className="text-brand-600" />}
      />
      <CardBody className="space-y-2">
        <p className="text-sm text-neutral-500">
          {durationSec > 0
            ? "길이가 입력돼 시청 완료율을 진단에 반영하고 있습니다."
            : "Instagram API는 영상 길이를 주지 않습니다. 길이를 넣으면 평균 시청 시간이 완료율로 바뀌어 진단에 합류합니다."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`duration-${reelId}`}>
            영상 길이 (초)
          </label>
          <input
            id={`duration-${reelId}`}
            type="number"
            min={1}
            max={900}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="예: 15"
            className="h-11 w-28 rounded-lg border border-border-subtle bg-surface px-3 text-sm tabular-nums focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:h-9"
          />
          <span className="text-sm text-neutral-500">초</span>
          <button
            type="button"
            onClick={save}
            disabled={!valid || busy}
            className="min-h-11 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9"
          >
            {busy ? "저장 중…" : "저장"}
          </button>
          {preview !== null && (
            // 저장 전에 결과를 보여줘 15초냐 60초냐로 해석이 뒤집힌다는 걸 드러낸다.
            <span className="text-sm text-neutral-500 tabular-nums">
              완료율 {fmtPct(preview)}
            </span>
          )}
        </div>
        {error && <p className="text-sm text-band-weak">{error}</p>}
      </CardBody>
    </Card>
  );
}
