"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Settings as SettingsIcon, ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui";
import { PROVIDER_PRESETS, type ProviderId } from "@/lib/llm/providers";

const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  kimi: "Kimi (Moonshot)",
  gemini: "Google Gemini",
};
const PROVIDER_ORDER: ProviderId[] = ["anthropic", "openai", "kimi", "gemini"];

// 드롭다운 옵션: 프리셋 모델 목록 + 저장돼 있던 현재 모델(목록에 없으면 보존).
function modelOptions(id: ProviderId, current: string): string[] {
  const preset = PROVIDER_PRESETS[id].models;
  return preset.includes(current) ? preset : [current, ...preset];
}

interface MaskedProvider {
  configured: boolean;
  maskedKey: string | null;
  model: string;
}
interface MaskedSettings {
  textProvider: ProviderId;
  providers: Record<ProviderId, MaskedProvider>;
  instagram: { configured: boolean; maskedKey: string | null };
}

export default function SettingsPage() {
  const [data, setData] = useState<MaskedSettings | null>(null);
  const [textProvider, setTextProvider] = useState<ProviderId>("anthropic");
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [modelInputs, setModelInputs] = useState<Record<string, string>>({});
  const [igToken, setIgToken] = useState("");
  const [status, setStatus] = useState("");

  function load(d: MaskedSettings) {
    setData(d);
    setTextProvider(d.textProvider);
    const models: Record<string, string> = {};
    for (const id of PROVIDER_ORDER) models[id] = d.providers[id].model;
    setModelInputs(models);
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(load);
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setStatus("저장 중…");
    const providers: Record<string, { apiKey: string; model: string }> = {};
    for (const id of PROVIDER_ORDER) {
      providers[id] = { apiKey: keyInputs[id] ?? "", model: modelInputs[id] ?? "" };
    }
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ textProvider, providers, instagram: { accessToken: igToken } }),
    });
    if (!res.ok) {
      setStatus("저장 실패");
      return;
    }
    load(await res.json());
    setKeyInputs({});
    setIgToken("");
    setStatus("저장됨 ✓");
  }

  if (!data) return <main className="p-6">불러오는 중…</main>;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
          <SettingsIcon size={20} className="text-brand-600" /> LLM 제공자 설정
        </h1>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-9"
        >
          <ArrowLeft size={14} /> 대시보드
        </Link>
      </div>
      <p className="text-sm text-neutral-500">
        키는 이 PC의 <code>data/settings.json</code>에만 저장되며 화면에는 마스킹되어 표시됩니다.
        자막 분석과 맞춤 대본 생성에 사용할 제공자와 모델을 선택할 수 있습니다.
      </p>

      <form onSubmit={onSave} className="space-y-3">
        {PROVIDER_ORDER.map((id) => {
          const p = data.providers[id];
          return (
            <div key={id} className="rounded-lg border border-neutral-200 p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold">{PROVIDER_LABELS[id]}</span>
                {p.configured && <span className="text-xs text-green-600">● 키 등록됨</span>}
                <span className="ml-auto flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="textProvider"
                      checked={textProvider === id}
                      onChange={() => setTextProvider(id)}
                    />
                    자막 분석
                  </label>
                </span>
              </div>
              <input
                type="password"
                className="border rounded px-2 py-1 w-full text-sm"
                placeholder={p.configured ? `등록됨 (${p.maskedKey}) — 변경 시에만 입력` : "API 키 입력"}
                value={keyInputs[id] ?? ""}
                onChange={(e) => setKeyInputs({ ...keyInputs, [id]: e.target.value })}
              />
              <label className="block text-xs text-neutral-500">
                모델
                <select
                  className="mt-0.5 border rounded bg-surface px-2 py-1 w-full text-sm"
                  value={modelInputs[id] ?? p.model}
                  onChange={(e) => setModelInputs({ ...modelInputs, [id]: e.target.value })}
                >
                  {modelOptions(id, modelInputs[id] ?? p.model).map((m) => (
                    <option key={m} value={m}>
                      {m === PROVIDER_PRESETS[id].defaultModel ? `${m} (기본)` : m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}

        <div className="rounded-card border border-brand-200 bg-brand-50/40 p-4 space-y-2">
          <h2 className="flex items-center gap-1.5 font-semibold">
            <Camera size={16} className="text-brand-600" /> Instagram 연동 (자동 수집)
          </h2>
          <p className="text-xs text-neutral-500">
            Meta 개발자 앱에서 발급한 Instagram 액세스 토큰을 붙여넣으세요. 대시보드의
            "Instagram 동기화"로 릴스 집계 지표·팔로워 수가 자동 갱신됩니다.
            {data.instagram.configured && (
              <span className="text-green-600"> · 현재 등록됨({data.instagram.maskedKey})</span>
            )}
          </p>
          <input
            type="password"
            className="border rounded px-2 py-1 w-full text-sm"
            placeholder={
              data.instagram.configured
                ? `등록됨 (${data.instagram.maskedKey}) — 변경 시에만 입력`
                : "Instagram 액세스 토큰 붙여넣기"
            }
            value={igToken}
            onChange={(e) => setIgToken(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary">
            저장
          </Button>
          {status && <span className="text-sm text-neutral-600">{status}</span>}
        </div>
      </form>
    </main>
  );
}
