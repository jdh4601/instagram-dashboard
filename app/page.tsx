"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Reel, AccountSnapshot, AccountProfile } from "@/lib/schemas";
import { buildAccountOverview } from "@/lib/analysis/accountOverview";
import { latestFollowerDelta } from "@/lib/analysis/followerTrend";
import { computeDashboardMetrics } from "@/lib/analysis/dashboardMetrics";
import { DashboardActions } from "@/components/DashboardActions";
import { AccountHeader } from "@/components/AccountHeader";
import { AccountOverview } from "@/components/AccountOverview";
import { Input, Button } from "@/components/ui";
import { ReelList } from "@/components/ReelList";
import { FollowerGrowthChart } from "@/components/FollowerGrowthChart";
import { EngagementPieChart } from "@/components/EngagementPieChart";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { InsightList } from "@/components/InsightList";
import { buildAccountInsights } from "@/lib/analysis/accountInsights";

export default function Page() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [snapshots, setSnapshots] = useState<AccountSnapshot[]>([]);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [snapDate, setSnapDate] = useState("");
  const [snapFollowers, setSnapFollowers] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function onSync() {
    setSyncing(true);
    setSyncStatus("");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncStatus("동기화 실패: " + (data.error ?? "오류"));
        return;
      }
      const [reelsRes, snapsRes, profileRes] = await Promise.all([
        fetch("/api/reels").then((r) => r.json()),
        fetch("/api/snapshots").then((r) => r.json()),
        fetch("/api/profile").then((r) => r.json()),
      ]);
      setReels(reelsRes.reels);
      setSnapshots(snapsRes.snapshots);
      setProfile(profileRes.profile);
      const unsupported = Array.isArray(data.unavailableMetrics) ? data.unavailableMetrics.length : 0;
      setSyncStatus(
        `동기화 완료: 릴스 ${data.syncedReels}개 · @${data.username}` +
          (unsupported > 0 ? ` · 선택 지표 ${unsupported}개 미지원` : ""),
      );
    } finally {
      setSyncing(false);
    }
  }

  // 동기화 알림은 3초간 보여주고 자동으로 사라진다.
  useEffect(() => {
    if (!syncStatus) return;
    const timer = setTimeout(() => setSyncStatus(""), 3000);
    return () => clearTimeout(timer);
  }, [syncStatus]);

  useEffect(() => {
    fetch("/api/reels")
      .then((r) => r.json())
      .then((d) => setReels(d.reels));
    fetch("/api/snapshots")
      .then((r) => r.json())
      .then((d) => setSnapshots(d.snapshots));
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile));
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

  return (
    <>
      <DashboardActions onSync={onSync} syncing={syncing} />
      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-4 sm:px-6 sm:pb-6">
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

        <form onSubmit={addSnapshot} className="flex flex-wrap items-center gap-2 text-sm">
          <Input type="date" value={snapDate} onChange={(e) => setSnapDate(e.target.value)} />
          <Input
            type="number"
            placeholder="팔로워 수"
            className="w-32"
            value={snapFollowers}
            onChange={(e) => setSnapFollowers(e.target.value)}
          />
          <Button type="submit">스냅샷 추가</Button>
        </form>
      </main>

      {syncStatus && (
        <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-black/70 px-4 py-2 text-sm text-white shadow-card-hover backdrop-blur-sm">
          {syncStatus}
        </div>
      )}
    </>
  );
}
