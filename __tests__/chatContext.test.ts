import { buildAccountContext, renderAccountContext, MAX_CONTEXT_REELS } from "@/lib/chat/context";
import type { AccountProfile, AccountSnapshot, Reel } from "@/lib/schemas";

function reel(overrides: Partial<Reel> = {}): Reel {
  return {
    id: "reel-1",
    postedAt: "2026-07-20T09:00:00Z",
    durationSec: 30,
    views: 12000,
    reach: 9000,
    likes: 300,
    comments: 20,
    saves: 40,
    shares: 60,
    avgWatchTimeSec: 12,
    hookRetention3s: 52,
    caption: "창업가 인터뷰 훅 실험",
    ...overrides,
  };
}

function snapshot(overrides: Partial<AccountSnapshot> = {}): AccountSnapshot {
  return {
    date: "2026-07-30",
    followerCount: 1200,
    reachLast7d: 40000,
    profileViewsLast7d: 900,
    followsLast7d: 60,
    unfollowsLast7d: 10,
    websiteClicksLast7d: 30,
    followerReachLast7d: 12000,
    nonFollowerReachLast7d: 28000,
    ...overrides,
  };
}

const profile: AccountProfile = {
  username: "founder.stories",
  followersCount: 1200,
  mediaCount: 40,
  updatedAt: "2026-07-30T00:00:00Z",
};

test("계정 컨텍스트에 프로필·퍼널·도달 구성·진단이 모두 담긴다", () => {
  const context = buildAccountContext([reel()], [snapshot({ date: "2026-07-23" }), snapshot()], profile);

  expect(context.profile.username).toBe("founder.stories");
  expect(context.profile.followers).toBe(1200);
  expect(context.funnel).not.toBeNull();
  expect(context.audienceMix).not.toBeNull();
  expect(context.reels).toHaveLength(1);
});

test("렌더링 결과에 판정 임계값 표가 포함된다", () => {
  // 챗봇이 대시보드와 다른 자로 강약을 판정하면 화면과 결론이 어긋난다.
  const rendered = renderAccountContext(
    buildAccountContext([reel()], [snapshot()], profile),
  );

  expect(rendered).toContain("판정 기준");
  expect(rendered).toContain("3초 훅 잔존");
  // 임계값 숫자 자체가 들어가야 모델이 근거를 댈 수 있다.
  expect(rendered).toContain("45");
});

test("데이터가 없으면 단정하지 않고 부족하다고 표기한다", () => {
  const rendered = renderAccountContext(buildAccountContext([], [], null));

  expect(rendered).toContain("데이터 부족");
  // 값이 없는데도 0을 사실처럼 적으면 모델이 "도달 0"이라고 진단한다.
  expect(rendered).not.toContain("도달: 0");
});

test(`게시물 요약은 최근 ${MAX_CONTEXT_REELS}개로 제한한다`, () => {
  const many = Array.from({ length: MAX_CONTEXT_REELS + 15 }, (_, i) =>
    reel({
      id: `reel-${i}`,
      // 뒤로 갈수록 최신이 되도록 날짜를 늘린다.
      postedAt: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T09:00:00Z`,
    }),
  );

  const context = buildAccountContext(many, [snapshot()], profile);
  expect(context.reels).toHaveLength(MAX_CONTEXT_REELS);
});

test("게시물 요약은 최신순으로 정렬한다", () => {
  const context = buildAccountContext(
    [
      reel({ id: "old", postedAt: "2026-07-01T09:00:00Z" }),
      reel({ id: "new", postedAt: "2026-07-29T09:00:00Z" }),
    ],
    [snapshot()],
    profile,
  );

  expect(context.reels[0].id).toBe("new");
});

test("긴 캡션은 잘라서 컨텍스트 분량을 예측 가능하게 유지한다", () => {
  const context = buildAccountContext(
    [reel({ caption: "가".repeat(200) })],
    [snapshot()],
    profile,
  );

  expect(context.reels[0].caption.length).toBeLessThanOrEqual(41);
});
