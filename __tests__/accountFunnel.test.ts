import { accountFunnelVerdicts, buildAccountFunnel } from "@/lib/analysis/accountFunnel";
import type { AccountSnapshot, Application } from "@/lib/schemas";

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

// --- 직전 스냅샷 대비 증감 (%p) ---

test("직전 스냅샷 대비 세 전환율의 증감을 %p로 계산", () => {
  const funnel = buildAccountFunnel([
    // 방문율 10%, 팔로우율 5%, 링크클릭율 2%
    snapshot({
      date: "2026-07-26",
      reachLast7d: 1000,
      profileViewsLast7d: 100,
      followsLast7d: 5,
      websiteClicksLast7d: 2,
    }),
    // 방문율 20%, 팔로우율 4%, 링크클릭율 3%
    snapshot({
      date: "2026-07-27",
      reachLast7d: 1000,
      profileViewsLast7d: 200,
      followsLast7d: 8,
      websiteClicksLast7d: 6,
    }),
  ])!;

  expect(funnel.previousDate).toBe("2026-07-26");
  expect(funnel.deltas.viewRate).toBeCloseTo(10, 5); // 20 − 10
  expect(funnel.deltas.followRate).toBeCloseTo(-1, 5); // 4 − 5
  expect(funnel.deltas.linkClickRate).toBeCloseTo(1, 5); // 3 − 2
});

test("직전 스냅샷이 없으면 증감은 전부 null", () => {
  const funnel = buildAccountFunnel([snapshot()])!;

  expect(funnel.previousDate).toBeNull();
  expect(funnel.deltas).toEqual({ viewRate: null, followRate: null, linkClickRate: null });
});

// 어제는 미수집이고 오늘만 있으면 "올랐다"가 아니다. 0에서 시작한 것처럼 보이면 안 된다.
test("직전 스냅샷에 지표가 없으면 그 항목만 null", () => {
  const funnel = buildAccountFunnel([
    snapshot({ date: "2026-07-26", websiteClicksLast7d: undefined }),
    snapshot({ date: "2026-07-27" }),
  ])!;

  expect(funnel.deltas.linkClickRate).toBeNull();
  expect(funnel.deltas.viewRate).toBeCloseTo(0, 5);
  expect(funnel.deltas.followRate).toBeCloseTo(0, 5);
});

test("증감 비교 대상은 가장 가까운 과거 스냅샷", () => {
  const funnel = buildAccountFunnel([
    snapshot({ date: "2026-07-20", profileViewsLast7d: 100, reachLast7d: 1000 }),
    snapshot({ date: "2026-07-26", profileViewsLast7d: 150, reachLast7d: 1000 }),
    snapshot({ date: "2026-07-27", profileViewsLast7d: 200, reachLast7d: 1000 }),
  ])!;

  expect(funnel.previousDate).toBe("2026-07-26");
  expect(funnel.deltas.viewRate).toBeCloseTo(5, 5); // 20 − 15
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

// --- 계정 퍼널 전환율 판정 (강점/약점/보통) ---

test("세 전환율이 모두 기준선 초과면 강점으로 판정", () => {
  // 방문률 13.48%, 전환율 6.79%, 링크클릭률 6.16% — 스크린샷 실측 사례
  const funnel = buildAccountFunnel([
    snapshot({ reachLast7d: 3493, profileViewsLast7d: 471, followsLast7d: 32, websiteClicksLast7d: 29 }),
  ])!;

  const verdicts = accountFunnelVerdicts(funnel);

  expect(verdicts.viewRate).toBe("strong");
  expect(verdicts.followRate).toBe("strong");
  expect(verdicts.linkClickRate).toBe("strong");
});

test("세 전환율이 모두 기준선 미만이면 약점으로 판정", () => {
  const funnel = buildAccountFunnel([
    snapshot({ reachLast7d: 10000, profileViewsLast7d: 50, followsLast7d: 0, websiteClicksLast7d: 0 }),
  ])!;

  const verdicts = accountFunnelVerdicts(funnel);

  expect(verdicts.viewRate).toBe("weak"); // 0.5%
  expect(verdicts.followRate).toBe("weak"); // 0%
  expect(verdicts.linkClickRate).toBe("weak"); // 0%
});

test("기준선 사이 값은 보통으로 판정", () => {
  // 방문률 2% — weakBelow 1, strongAbove 3 사이
  const funnel = buildAccountFunnel([
    snapshot({ reachLast7d: 1000, profileViewsLast7d: 20, followsLast7d: 1, websiteClicksLast7d: 1 }),
  ])!;

  const verdicts = accountFunnelVerdicts(funnel);

  expect(verdicts.viewRate).toBe("ok");
});

test("측정 안 된 지표는 null로 판정", () => {
  const funnel = buildAccountFunnel([snapshot({ profileViewsLast7d: undefined })])!;

  const verdicts = accountFunnelVerdicts(funnel);

  expect(verdicts.viewRate).toBeNull();
  expect(verdicts.followRate).toBeNull();
});

// ── 신청(Walla) 연결 구간 ──────────────────────────────────────────────

function app(overrides: Partial<Application> = {}): Application {
  return {
    responseId: `r-${Math.random()}`,
    submittedAt: "2026-07-27T09:00:00Z",
    source: "instagram",
    medium: "bio",
    ...overrides,
  };
}

test("신청을 넘기지 않으면 신청 지표는 null이다", () => {
  // 미연동과 "신청 0건"은 다르다. 0으로 채우면 전환율이 0%로 보인다.
  const funnel = buildAccountFunnel([snapshot()])!;

  expect(funnel.applications).toBeNull();
  expect(funnel.bioApplications).toBeNull();
  expect(funnel.applyRate).toBeNull();
});

test("빈 신청 목록은 0건으로 센다", () => {
  const funnel = buildAccountFunnel([snapshot()], [])!;

  expect(funnel.applications).toBe(0);
  expect(funnel.applyRate).toBe(0);
});

test("7일 창 안의 신청만 센다", () => {
  // 창은 스냅샷 날짜(2026-07-27)에서 6일 전(2026-07-21)까지다.
  const funnel = buildAccountFunnel(
    [snapshot()],
    [
      app({ submittedAt: "2026-07-21T00:00:00Z" }),
      app({ submittedAt: "2026-07-27T23:59:00Z" }),
      app({ submittedAt: "2026-07-20T23:59:00Z" }),
      app({ submittedAt: "2026-07-28T00:00:00Z" }),
    ],
  )!;

  expect(funnel.applications).toBe(2);
});

test("applyRate는 바이오 유입 신청만 분자로 쓴다", () => {
  // websiteClicks는 바이오 링크 클릭만 센다. 스토리·광고 신청을 분자에 넣으면
  // 분모에 없는 유입이 섞여 전환율이 부풀어 오른다.
  const funnel = buildAccountFunnel(
    [snapshot({ websiteClicksLast7d: 24 })],
    [app({ medium: "bio" }), app({ medium: "bio" }), app({ medium: "story" }), app({ medium: "paid" })],
  )!;

  expect(funnel.applications).toBe(4);
  expect(funnel.bioApplications).toBe(2);
  expect(funnel.applyRate).toBeCloseTo(8.33, 2);
});

test("UTM이 없는 신청은 바이오로 치지 않는다", () => {
  const funnel = buildAccountFunnel([snapshot()], [app({ medium: undefined })])!;

  expect(funnel.applications).toBe(1);
  expect(funnel.bioApplications).toBe(0);
});

test("링크 클릭이 측정되지 않으면 applyRate는 null이다", () => {
  const funnel = buildAccountFunnel(
    [snapshot({ websiteClicksLast7d: undefined })],
    [app()],
  )!;

  expect(funnel.applications).toBe(1);
  expect(funnel.applyRate).toBeNull();
});

test("매체별 신청 수를 갈라 준다", () => {
  const funnel = buildAccountFunnel(
    [snapshot()],
    [app({ medium: "bio" }), app({ medium: "paid" }), app({ medium: "paid" }), app({ medium: undefined })],
  )!;

  expect(funnel.applicationsByMedium).toEqual({ bio: 1, paid: 2, unknown: 1 });
});

test("신청이 클릭보다 많으면 100%를 넘겨 그대로 보여준다", () => {
  // 클릭한 날과 신청한 날이 달라 창 경계에서 실제로 일어난다. 잘라내면
  // 지표가 이상하다는 신호까지 함께 사라진다.
  const funnel = buildAccountFunnel(
    [snapshot({ websiteClicksLast7d: 1 })],
    [app(), app()],
  )!;

  expect(funnel.applyRate).toBeCloseTo(200, 0);
});
