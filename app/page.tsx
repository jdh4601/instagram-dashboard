"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";
import type { Reel, AccountSnapshot, AccountProfile } from "@/lib/schemas";
import { buildAccountOverview } from "@/lib/analysis/accountOverview";
import { latestFollowerDelta } from "@/lib/analysis/followerTrend";
import { computeDashboardMetrics } from "@/lib/analysis/dashboardMetrics";
import { DashboardActions } from "@/components/DashboardActions";
import { AccountHeader } from "@/components/AccountHeader";
import { AccountOverview } from "@/components/AccountOverview";
import { Input, Button, Skeleton } from "@/components/ui";
import { ReelList } from "@/components/ReelList";
import { FollowerGrowthChart } from "@/components/FollowerGrowthChart";
import { EngagementPieChart } from "@/components/EngagementPieChart";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { InsightList } from "@/components/InsightList";
import { buildAccountInsights } from "@/lib/analysis/accountInsights";

interface SyncToast {
  tone: "success" | "warning" | "error";
  message: string;
}

// Instagram 장기 토큰은 60일에 만료되므로 50일이 지나면 갱신을 안내한다.
const TOKEN_WARN_DAYS = 50;

export default function Page() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [snapshots, setSnapshots] = useState<AccountSnapshot[]>([]);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [snapDate, setSnapDate] = useState("");
  const [snapFollowers, setSnapFollowers] = useState("");
  const [toast, setToast] = useState<SyncToast | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [instagramConfigured, setInstagramConfigured] = useState(false);
  const [tokenIssuedAt, setTokenIssuedAt] = useState<string | null>(null);
  const [tokenBannerDismissed, setTokenBannerDismissed] = useState(false);

  async function onSync() {
    setSyncing(true);
    setToast(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ tone: "error", message: "동기화 실패: " + (data.error ?? "오류") });
        return;
      }
      const refreshedResponses = await Promise.all([
        fetch("/api/reels"),
        fetch("/api/snapshots"),
        fetch("/api/profile"),
      ]);
      if (refreshedResponses.some((response) => !response.ok)) {
        throw new Error("동기화 후 화면 갱신 실패");
      }
      const [reelsRes, snapsRes, profileRes] = await Promise.all(
        refreshedResponses.map((response) => response.json()),
      );
      setReels(reelsRes.reels);
      setSnapshots(snapsRes.snapshots);
      setProfile(profileRes.profile);
      const failed = typeof data.failedReels === "number" ? data.failedReels : 0;
      if (failed > 0) {
        const errors: string[] = Array.isArray(data.errors)
          ? data.errors.filter((e: unknown): e is string => typeof e === "string")
          : [];
        setToast({
          tone: "warning",
          message:
            `동기화 일부 실패: 게시물 ${failed}개를 가져오지 못했습니다` +
            (errors.length > 0 ? ` — ${errors.slice(0, 2).join(" / ")}` : ""),
        });
        return;
      }
      const unsupported = Array.isArray(data.unavailableMetrics) ? data.unavailableMetrics.length : 0;
      const removed = typeof data.removedReels === "number" ? data.removedReels : 0;
      setToast({
        tone: "success",
        message:
          `동기화 완료: 게시물 ${data.syncedReels}개 · @${data.username}` +
          (removed > 0 ? ` · 삭제된 게시물 ${removed}개 정리` : "") +
          (unsupported > 0 ? ` · 선택 지표 ${unsupported}개 미지원` : ""),
      });
    } catch {
      setToast({ tone: "error", message: "동기화 실패: 네트워크 또는 화면 갱신 오류가 발생했습니다" });
    } finally {
      setSyncing(false);
    }
  }

  // 성공 알림만 3초간 보여주고 자동으로 사라진다. 경고·오류는 직접 닫기 전까지 유지한다.
  useEffect(() => {
    if (!toast || toast.tone !== "success") return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;

    async function getJson(path: string) {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`${path} 요청 실패`);
      return response.json();
    }

    Promise.allSettled([
      getJson("/api/reels"),
      getJson("/api/snapshots"),
      getJson("/api/profile"),
      getJson("/api/settings"),
    ]).then(([reelsResult, snapshotsResult, profileResult, settingsResult]) => {
      if (!active) return;

      if (reelsResult.status === "fulfilled") setReels(reelsResult.value.reels ?? []);
      if (snapshotsResult.status === "fulfilled") setSnapshots(snapshotsResult.value.snapshots ?? []);
      if (profileResult.status === "fulfilled") setProfile(profileResult.value.profile ?? null);
      if (settingsResult.status === "fulfilled") {
        const issuedAt = settingsResult.value.instagramTokenIssuedAt;
        setInstagramConfigured(settingsResult.value.instagram?.configured === true);
        setTokenIssuedAt(typeof issuedAt === "string" ? issuedAt : null);
      }

      if ([reelsResult, snapshotsResult, profileResult].some((result) => result.status === "rejected")) {
        setToast({
          tone: "error",
          message: "대시보드 데이터를 모두 불러오지 못했습니다. 잠시 후 새로고침해 주세요.",
        });
      }
      setInitialLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function addSnapshot(e: FormEvent) {
    e.preventDefault();
    if (!snapDate || !snapFollowers) return;
    const res = await fetch("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: snapDate,
        followerCount: Number(snapFollowers),
        reachLast7d: 0,
      }),
    });
    if (!res.ok) return;
    const refreshed = await fetch("/api/snapshots").then((r) => r.json());
    setSnapshots(refreshed.snapshots);
    setSnapDate("");
    setSnapFollowers("");
  }

  const overview = buildAccountOverview(reels, snapshots, profile);
  const followerDelta = latestFollowerDelta(snapshots);
  const dashboardMetrics = computeDashboardMetrics(reels);
  const accountInsights = buildAccountInsights(snapshots);

  const tokenSavedAtMs = tokenIssuedAt ? Date.parse(tokenIssuedAt) : Number.NaN;
  const tokenSavedAtKnown = Number.isFinite(tokenSavedAtMs);
  const tokenAgeMs = tokenSavedAtKnown ? Date.now() - tokenSavedAtMs : null;
  const tokenAgeUnknown = instagramConfigured && !tokenSavedAtKnown;
  const tokenNeedsReview = tokenAgeMs !== null && tokenAgeMs > TOKEN_WARN_DAYS * 24 * 60 * 60 * 1000;
  const showTokenBanner =
    !tokenBannerDismissed && (tokenAgeUnknown || tokenNeedsReview);

  return (
    <>
      <DashboardActions onSync={onSync} syncing={syncing} />
      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-4 sm:px-6 sm:pb-6">
        {initialLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {showTokenBanner && (
              <div className="flex items-center justify-between gap-3 rounded-card border border-band-ok-border bg-band-ok-soft px-4 py-2.5 text-sm text-band-ok">
                <span>
                  {tokenAgeUnknown
                    ? "등록된 Instagram 토큰의 갱신 시점을 확인할 수 없습니다"
                    : "Instagram 토큰을 이 앱에 저장하거나 변경한 지 50일 이상 지났습니다"}
                  {" — "}
                  <Link
                    href="/settings"
                    className="rounded-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    설정에서 갱신 여부를 확인
                  </Link>
                  해 주세요.
                </span>
                <button
                  type="button"
                  onClick={() => setTokenBannerDismissed(true)}
                  aria-label="배너 닫기"
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-9 sm:min-w-9"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <AccountHeader profile={profile} followerDelta={followerDelta} />
            <AccountOverview overview={overview} />
            <InsightList
              title="계정 인사이트"
              insights={accountInsights}
              helpText="최근 저장된 7일 계정 스냅샷을 기준으로 Graph API의 도달, 참여 계정, 팔로우·언팔로우를 사용합니다. 참여율은 참여 계정 ÷ 도달, 순 팔로워는 팔로우 − 언팔로우로 계산하며, 7일 이상 이전 스냅샷이 있으면 도달 증감도 비교합니다. 값이 없는 지표는 인사이트에서 제외합니다."
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <FollowerGrowthChart snapshots={snapshots} />
              <EngagementPieChart reels={reels} />
            </div>

            <DashboardMetrics metrics={dashboardMetrics} />

            <ReelList reels={reels} />

            <form
              onSubmit={addSnapshot}
              className="space-y-2"
              aria-labelledby="snapshot-form-title"
            >
              <h2 id="snapshot-form-title" className="text-sm font-semibold text-neutral-700">
                팔로워 스냅샷 추가
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="sr-only" htmlFor="snapshot-date">
                  날짜
                </label>
                <Input
                  id="snapshot-date"
                  type="date"
                  value={snapDate}
                  onChange={(e) => setSnapDate(e.target.value)}
                />
                <label className="sr-only" htmlFor="snapshot-followers">
                  팔로워 수
                </label>
                <Input
                  id="snapshot-followers"
                  type="number"
                  placeholder="팔로워 수"
                  className="w-32"
                  value={snapFollowers}
                  onChange={(e) => setSnapFollowers(e.target.value)}
                />
                <Button type="submit">스냅샷 추가</Button>
              </div>
            </form>
          </>
        )}
      </main>

      {toast && (
        <div
          role={toast.tone === "success" ? "status" : "alert"}
          aria-live={toast.tone === "success" ? "polite" : "assertive"}
          aria-atomic="true"
          className={`fixed bottom-4 left-4 right-4 z-30 flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-card-hover sm:left-1/2 sm:right-auto sm:max-w-xl sm:-translate-x-1/2 ${
            toast.tone === "success"
              ? "border-band-strong-border bg-band-strong-soft text-band-strong"
              : toast.tone === "warning"
                ? "border-band-ok-border bg-band-ok-soft text-band-ok"
                : "border-band-weak-border bg-band-weak-soft text-band-weak"
          }`}
        >
          {toast.tone === "success" ? (
            <CheckCircle2 size={17} className="shrink-0" />
          ) : toast.tone === "warning" ? (
            <AlertTriangle size={17} className="shrink-0" />
          ) : (
            <XCircle size={17} className="shrink-0" />
          )}
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.tone !== "success" && (
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="알림 닫기"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="대시보드 불러오는 중">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
      <Skeleton className="h-48 rounded-card" />
      <span className="sr-only">대시보드를 불러오고 있습니다.</span>
    </div>
  );
}
