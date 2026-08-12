"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Reel, AccountSnapshot, AccountProfile, Application } from "@/lib/schemas";
import { buildAccountOverview } from "@/lib/analysis/accountOverview";
import { latestFollowerDelta } from "@/lib/analysis/followerTrend";
import { computeDashboardMetrics } from "@/lib/analysis/dashboardMetrics";
import { DashboardActions } from "@/components/DashboardActions";
import { SyncProgressBar } from "@/components/SyncProgressBar";
import { AccountHeader } from "@/components/AccountHeader";
import { UploadRhythmCard } from "@/components/UploadRhythmCard";
import { AccountOverview } from "@/components/AccountOverview";
import { AccountFunnelCard } from "@/components/AccountFunnelCard";
import { AudienceMixCard } from "@/components/AudienceMixCard";
import { buildAccountFunnel } from "@/lib/analysis/accountFunnel";
import { buildAudienceMix } from "@/lib/analysis/audienceMix";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { DashboardToast, type SyncToast } from "@/components/DashboardToast";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PerformanceChartsCard } from "@/components/PerformanceChartsCard";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { filterByMedia } from "@/lib/ui/mediaFilter";
import { readNdjson } from "@/lib/ui/ndjsonStream";
import { buildSyncToast } from "@/lib/ui/syncToast";
import type { SyncProgress, SyncResult } from "@/lib/graph/sync";
import { DAY_MS } from "@/lib/time";

// Instagram 장기 토큰은 60일에 만료되므로 50일이 지나면 갱신을 안내한다.
const TOKEN_WARN_DAYS = 50;
// 만료 시각을 아는 토큰은 남은 기간으로 판단한다. 갱신에 쓸 여유를 열흘 둔다.
const TOKEN_EXPIRY_WARN_DAYS = 10;

export default function Page() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [snapshots, setSnapshots] = useState<AccountSnapshot[]>([]);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  // 신청 폼 미연동과 "신청 0건"을 구분해야 해서 빈 배열이 아니라 null로 시작한다.
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [toast, setToast] = useState<SyncToast | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tokenIssuedAt, setTokenIssuedAt] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [tokenBannerDismissed, setTokenBannerDismissed] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  async function onSync() {
    setSyncing(true);
    setToast(null);
    setSyncProgress({ completed: 0, total: 0 });
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      });
      if (!res.ok || !res.body) {
        const failed = await res.json().catch(() => ({}));
        setToast({ tone: "error", message: "동기화 실패: " + (failed.error ?? "오류") });
        return;
      }

      // 스트림은 헤더를 먼저 보내므로 실패도 상태 코드가 아니라 마지막 이벤트로 온다.
      let data: SyncResult | null = null;
      let streamError: string | null = null;
      for await (const event of readNdjson(res.body)) {
        const parsed = event as { type?: string } & Record<string, unknown>;
        if (parsed.type === "progress") {
          setSyncProgress({ completed: Number(parsed.completed), total: Number(parsed.total) });
        } else if (parsed.type === "result") {
          data = parsed as unknown as SyncResult;
        } else if (parsed.type === "error") {
          streamError = String(parsed.error);
        }
      }
      if (streamError !== null || data === null) {
        setToast({
          tone: "error",
          message: "동기화 실패: " + (streamError ?? "응답이 완결되지 않았습니다"),
        });
        return;
      }

      const refreshedResponses = await Promise.all([
        fetch("/api/reels"),
        fetch("/api/snapshots"),
        fetch("/api/profile"),
        fetch("/api/applications"),
      ]);
      if (refreshedResponses.some((response) => !response.ok)) {
        throw new Error("동기화 후 화면 갱신 실패");
      }
      const [reelsRes, snapsRes, profileRes, applicationsRes] = await Promise.all(
        refreshedResponses.map((response) => response.json()),
      );
      setReels(reelsRes.reels);
      setSnapshots(snapsRes.snapshots);
      setProfile(profileRes.profile);
      setApplications(applicationsRes.applications ?? []);
      // 서버가 방금 기록한 것과 같은 시각이다. /api/settings를 다시 부르지 않고 반영한다.
      setLastSyncedAt(new Date().toISOString());
      setToast(buildSyncToast(data));
    } catch {
      setToast({ tone: "error", message: "동기화 실패: 네트워크 또는 화면 갱신 오류가 발생했습니다" });
    } finally {
      setSyncing(false);
      setSyncProgress(null);
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
      getJson("/api/applications"),
    ]).then(([reelsResult, snapshotsResult, profileResult, settingsResult, applicationsResult]) => {
      if (!active) return;

      if (reelsResult.status === "fulfilled") {
        setReels(reelsResult.value.reels ?? []);
      }
      if (snapshotsResult.status === "fulfilled") setSnapshots(snapshotsResult.value.snapshots ?? []);
      if (profileResult.status === "fulfilled") setProfile(profileResult.value.profile ?? null);
      if (applicationsResult.status === "fulfilled") {
        setApplications(applicationsResult.value.applications ?? []);
      }
      if (settingsResult.status === "fulfilled") {
        const issuedAt = settingsResult.value.instagramTokenIssuedAt;
        setTokenIssuedAt(typeof issuedAt === "string" ? issuedAt : null);
        const expiresAt = settingsResult.value.instagramTokenExpiresAt;
        setTokenExpiresAt(typeof expiresAt === "string" ? expiresAt : null);
        const syncedAt = settingsResult.value.lastSyncedAt;
        setLastSyncedAt(typeof syncedAt === "string" ? syncedAt : null);
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

  // 대시보드는 릴스+캐러셀 합산 고정이다. 매체별로 나눠 보는 화면은 /reels가 맡는다.
  const overview = buildAccountOverview(reels, snapshots, profile);
  const followerDelta = latestFollowerDelta(snapshots);
  // 평균 시청시간·3초 잔존율은 캐러셀에 존재하지 않는 지표라 항상 릴스만 집계한다.
  const dashboardMetrics = computeDashboardMetrics(filterByMedia(reels, "REELS"));
  // 퍼널은 계정 레벨이다. Graph가 릴스에 profile_visits/follows를 주지 않고, 게시물
  // 귀속 팔로우는 실제 증가분의 일부만 설명한다.
  // 신청은 Graph 밖 데이터라 미연동이면 undefined를 넘겨 신청 구간을 통째로 감춘다.
  const funnel = buildAccountFunnel(snapshots, applications ?? undefined);
  // 도달 구성도 계정 레벨 스냅샷에서 온다.
  const audienceMix = buildAudienceMix(snapshots);

  // 저장 시점을 모르는 토큰은 경고하지 않는다. 토큰을 이 앱에 저장하기 전부터 쓰던
  // 사용자는 갱신 여부와 무관하게 배너가 영구히 떠서, 조치할 수 없는 알림이 된다.
  const tokenSavedAtMs = tokenIssuedAt ? Date.parse(tokenIssuedAt) : Number.NaN;
  const tokenExpiryMs = tokenExpiresAt ? Date.parse(tokenExpiresAt) : Number.NaN;
  const tokenAgeMs = Number.isFinite(tokenSavedAtMs) ? Date.now() - tokenSavedAtMs : null;
  const tokenNeedsReview = Number.isFinite(tokenExpiryMs)
    ? tokenExpiryMs - Date.now() < TOKEN_EXPIRY_WARN_DAYS * DAY_MS
    : tokenAgeMs !== null && tokenAgeMs > TOKEN_WARN_DAYS * DAY_MS;
  const showTokenBanner = !tokenBannerDismissed && tokenNeedsReview;

  return (
    // xl 이상에서 대시보드와 진단 패널이 나란히 서고, 그 아래 폭에서는 패널이
    // 오른쪽 가장자리에 접혀 손잡이만 남는다.
    <div className="mx-auto flex w-full max-w-[110rem] items-start">
      <div className="min-w-0 flex-1">
      <DashboardActions onSync={onSync} syncing={syncing} lastSyncedAt={lastSyncedAt} />
      {syncing && syncProgress && <SyncProgressBar progress={syncProgress} />}
      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-4 sm:px-6 sm:pb-6">
        {initialLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {showTokenBanner && (
              <div className="flex items-center justify-between gap-3 rounded-card border border-band-ok-border bg-band-ok-soft px-4 py-2.5 text-sm text-band-ok">
                <span>
                  Instagram 토큰을 이 앱에 저장하거나 변경한 지 50일 이상 지났습니다
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
              <div className="shrink-0 lg:max-w-md">
                <AccountHeader profile={profile} followerDelta={followerDelta} contentCount={reels.length} />
              </div>
              <UploadRhythmCard reels={reels} />
            </div>
            <AccountOverview overview={overview} />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <AccountFunnelCard funnel={funnel} />
              <AudienceMixCard mix={audienceMix} reels={reels} />
            </div>

            {/* 추이는 가로가 길수록 읽기 쉬우므로 한 행을 다 쓴다. 팔로워 추이는
                이 카드의 누적 차트가 대신하므로 FollowerGrowthChart는 걷어냈다. */}
            <PerformanceChartsCard reels={reels} snapshots={snapshots} />

            <DashboardMetrics metrics={dashboardMetrics} />
          </>
        )}
      </main>

      </div>

      <ChatPanel />

      {toast && <DashboardToast toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
