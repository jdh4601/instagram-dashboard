"use client";
import type { ChatProviderOption } from "@/lib/chat/providerOptions";

const SELECT =
  "min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface px-2 py-1 text-xs text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50";

interface ChatProviderPickerProps {
  options: ChatProviderOption[];
  /** 지금 골라진 제공자 id. 서버가 알려 준 값이다. */
  provider: string | null;
  /** 지금 쓰는 모델. 빈 값은 "제공자 기본 모델"을 뜻한다. */
  modelName: string;
  busy: boolean;
  onChange(provider: string, model?: string): void;
}

/**
 * 진단 패널에서 백엔드를 바꾸는 두 드롭다운.
 *
 * 모델 목록은 고른 제공자의 것만 담는다. 서버가 프리셋 목록 밖의 이름을 거절하므로,
 * 여기서 섞어 보여 주면 사용자가 고를 수 있는데 저장은 안 되는 값이 생긴다.
 */
export function ChatProviderPicker({
  options,
  provider,
  modelName,
  busy,
  onChange,
}: ChatProviderPickerProps) {
  if (options.length === 0) return null;

  const selected = options.find((option) => option.id === provider) ?? null;
  const cliOptions = options.filter((option) => option.kind === "cli");
  const apiOptions = options.filter((option) => option.kind === "api");

  return (
    <div className="border-b border-border-subtle bg-surface-muted/40 px-4 py-2">
      <div className="flex items-center gap-1.5">
        <select
          aria-label="진단 AI 제공자"
          className={SELECT}
          value={provider ?? ""}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
        >
          {/* 서버가 고를 수 없다고 한 항목도 남겨 둔다. 목록에서 지워 버리면
              왜 못 쓰는지(미설치·키 없음)를 알 방법이 사라진다. */}
          <optgroup label="로컬 CLI">
            {cliOptions.map((option) => (
              <option key={option.id} value={option.id} disabled={!option.ready}>
                {option.ready ? option.label : `${option.label} — ${option.hint}`}
              </option>
            ))}
          </optgroup>
          <optgroup label="API 제공자">
            {apiOptions.map((option) => (
              <option key={option.id} value={option.id} disabled={!option.ready}>
                {option.ready ? option.label : `${option.label} — ${option.hint}`}
              </option>
            ))}
          </optgroup>
        </select>

        <select
          aria-label="진단 AI 모델"
          className={SELECT}
          value={modelName}
          disabled={busy || selected === null}
          onChange={(e) => provider && onChange(provider, e.target.value)}
        >
          <option value="">기본 모델</option>
          {(selected?.models ?? []).map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {selected?.sharedModel && (
        <p className="mt-1 text-[11px] leading-snug text-neutral-500">
          이 제공자의 모델은 자막 분석과 함께 쓰는 값입니다.
        </p>
      )}
    </div>
  );
}
