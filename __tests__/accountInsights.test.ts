import { buildAccountInsights } from "@/lib/analysis/accountInsights";

test("계정 7일 순 팔로워와 참여율 인사이트를 생성", () => {
  const insights = buildAccountInsights([{
    date: "2026-07-05",
    followerCount: 250,
    reachLast7d: 5000,
    accountsEngagedLast7d: 400,
    followsLast7d: 30,
    unfollowsLast7d: 8,
  }]);
  expect(insights).toContainEqual(expect.objectContaining({ id: "net-followers", currentValue: 22 }));
  expect(insights).toContainEqual(expect.objectContaining({ id: "engaged-reach", currentValue: 8 }));
});

test("7일 이상 떨어진 비교점이 있을 때만 도달 추세를 생성", () => {
  const close = buildAccountInsights([
    { date: "2026-07-04", followerCount: 240, reachLast7d: 4000 },
    { date: "2026-07-05", followerCount: 250, reachLast7d: 5000 },
  ]);
  expect(close.some((insight) => insight.id === "reach-trend")).toBe(false);

  const comparable = buildAccountInsights([
    { date: "2026-06-28", followerCount: 230, reachLast7d: 4000 },
    { date: "2026-07-05", followerCount: 250, reachLast7d: 5000 },
  ]);
  expect(comparable).toContainEqual(expect.objectContaining({ id: "reach-trend", tone: "strength" }));
});
