"use client";
import { useState } from "react";
import { AdEfficiencyPanel } from "@/components/AdEfficiencyPanel";
import { AdUnitPanel } from "@/components/AdUnitPanel";
import { cn } from "@/components/ui";

/**
 * 광고를 보는 두 축.
 *
 * "광고별"은 집행한 광고 하나가 한 줄이라 상태·목표·예산·기간을 그대로 보여 주고,
 * "게시물별"은 한 게시물에 여러 번 태운 것을 합쳐 오가닉과 견준다. 두 축을 한 표에
 * 욱여넣으면 합산한 줄과 낱개 줄이 섞여 어느 수가 무엇인지 읽을 수 없다.
 */
const TABS = [
  { key: "units", label: "광고별" },
  { key: "posts", label: "게시물별" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdsPage() {
  const [tab, setTab] = useState<TabKey>("units");

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-4 sm:px-6 sm:py-6">
      <header>
        <h1 className="text-lg font-semibold text-neutral-900">광고</h1>
        <p className="mt-1 text-sm text-neutral-500">
          집행한 광고의 성과를 광고 단위와 게시물 단위로 봅니다.
        </p>
      </header>

      <div role="tablist" aria-label="광고 보기" className="flex gap-1 border-b border-border-subtle">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "-mb-px min-h-11 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              tab === item.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-neutral-500 hover:text-neutral-900",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "units" ? <AdUnitPanel /> : <AdEfficiencyPanel />}
    </main>
  );
}
