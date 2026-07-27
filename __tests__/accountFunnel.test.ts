import { buildAccountFunnel } from "@/lib/analysis/accountFunnel";
import type { AccountSnapshot } from "@/lib/schemas";

function snapshot(overrides: Partial<AccountSnapshot> = {}): AccountSnapshot {
  return {
    date: "2026-07-27",
    followerCount: 306,
    reachLast7d: 3887,
    profileViewsLast7d: 466,
    followsLast7d: 27,
    unfollowsLast7d: 4,
    websiteClicksLast7d: 24,
    ...overrides,
  };
}

test("최신 스냅샷으로 도달→방문→팔로우 퍼널과 순증을 만든다", () => {
  const funnel = buildAccountFunnel([snapshot({ date: "2026-07-26" }), snapshot()]);

  expect(funnel).not.toBeNull();
  expect(funnel!.date).toBe("2026-07-27");
  expect(funnel!.reach).toBe(3887);
  expect(funnel!.profileViews).toBe(466);
  expect(funnel!.follows).toBe(27);
  expect(funnel!.unfollows).toBe(4);
  expect(funnel!.netFollows).toBe(23);
  expect(funnel!.viewRate).toBeCloseTo(11.99, 1);
  expect(funnel!.followRate).toBeCloseTo(5.79, 1);
});

test("날짜가 뒤섞여 저장돼도 가장 최근 스냅샷을 고른다", () => {
  const funnel = buildAccountFunnel([
    snapshot({ date: "2026-07-27", followsLast7d: 27 }),
    snapshot({ date: "2026-07-20", followsLast7d: 9 }),
  ]);

  expect(funnel!.follows).toBe(27);
});

// 누락을 0으로 채우면 "방문이 없다"와 "측정이 안 된다"가 구분되지 않는다.
test("프로필 방문이 없으면 방문·팔로우 전환율을 null로 둔다", () => {
  const funnel = buildAccountFunnel([snapshot({ profileViewsLast7d: undefined })]);

  expect(funnel!.profileViews).toBeNull();
  expect(funnel!.viewRate).toBeNull();
  expect(funnel!.followRate).toBeNull();
  // 팔로우 자체는 방문과 별개로 측정되므로 남는다
  expect(funnel!.follows).toBe(27);
  expect(funnel!.netFollows).toBe(23);
});

test("언팔로우가 없으면 순증을 계산하지 않는다", () => {
  const funnel = buildAccountFunnel([snapshot({ unfollowsLast7d: undefined })]);

  expect(funnel!.unfollows).toBeNull();
  expect(funnel!.netFollows).toBeNull();
  expect(funnel!.follows).toBe(27);
});

test("도달이 0이면 방문 전환율을 계산하지 않는다", () => {
  const funnel = buildAccountFunnel([snapshot({ reachLast7d: 0 })]);

  expect(funnel!.viewRate).toBeNull();
});

// 링크 클릭은 팔로우 다음 단계가 아니라 프로필 방문에서 갈라지는 나란한 결과다.
// 그래서 분모가 팔로우가 아니라 방문이다.
test("링크 클릭 전환율의 분모는 팔로우가 아니라 프로필 방문", () => {
  const funnel = buildAccountFunnel([snapshot()]);

  expect(funnel!.websiteClicks).toBe(24);
  expect(funnel!.linkClickRate).toBeCloseTo((24 / 466) * 100, 5);
});

test("링크 클릭이 미측정이면 클릭 수와 전환율을 null로 둔다", () => {
  const funnel = buildAccountFunnel([snapshot({ websiteClicksLast7d: undefined })]);

  expect(funnel!.websiteClicks).toBeNull();
  expect(funnel!.linkClickRate).toBeNull();
  // 나머지 단계는 영향받지 않는다
  expect(funnel!.follows).toBe(27);
});

test("프로필 방문이 없으면 링크 클릭 수는 남기고 전환율만 null", () => {
  const funnel = buildAccountFunnel([snapshot({ profileViewsLast7d: undefined })]);

  expect(funnel!.websiteClicks).toBe(24);
  expect(funnel!.linkClickRate).toBeNull();
});

// 팔로우·방문이 없어도 링크 클릭이 있으면 보여줄 단계가 남는다.
test("링크 클릭만 측정돼도 퍼널을 만든다", () => {
  const funnel = buildAccountFunnel([
    snapshot({ profileViewsLast7d: undefined, followsLast7d: undefined, unfollowsLast7d: undefined }),
  ]);

  expect(funnel).not.toBeNull();
  expect(funnel!.websiteClicks).toBe(24);
});

test("스냅샷이 없으면 null", () => {
  expect(buildAccountFunnel([])).toBeNull();
});

// 팔로우·방문이 모두 미측정이면 남는 건 도달 하나뿐이라 퍼널이 아니다.
test("도달 말고 아무것도 측정되지 않으면 null", () => {
  const funnel = buildAccountFunnel([
    snapshot({
      profileViewsLast7d: undefined,
      followsLast7d: undefined,
      unfollowsLast7d: undefined,
      websiteClicksLast7d: undefined,
    }),
  ]);

  expect(funnel).toBeNull();
});
