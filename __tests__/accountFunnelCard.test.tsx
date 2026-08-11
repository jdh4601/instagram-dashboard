import { renderToStaticMarkup } from "react-dom/server";
import { AccountFunnelCard } from "@/components/AccountFunnelCard";
import type { AccountFunnel } from "@/lib/analysis/accountFunnel";

const funnel: AccountFunnel = {
  date: "2026-07-30",
  reach: 3036,
  profileViews: 426,
  follows: 30,
  unfollows: 4,
  netFollows: 26,
  websiteClicks: 31,
  viewRate: 14.03,
  followRate: 7.04,
  linkClickRate: 7.28,
  previousDate: "2026-07-29",
  deltas: {
    viewRate: 0.55,
    followRate: 0.25,
    linkClickRate: 1.12,
  },
  applications: null,
  bioApplications: null,
  applyRate: null,
  applicationsByMedium: {},
};

test("계정 전환 UI는 절대값 막대 대신 단계·분기와 전환율을 보여준다", () => {
  const html = renderToStaticMarkup(<AccountFunnelCard funnel={funnel} />);

  expect(html).toContain("최근 7일 계정 전환 흐름");
  expect(html).toContain("3,036");
  expect(html).toContain("14.03% 방문 전환");
  expect(html).toContain("방문 후 행동");
  expect(html).toContain("팔로우");
  expect(html).toContain("링크 클릭");
  expect(html).toContain("7.04%");
  expect(html).toContain("7.28%");
  expect(html).not.toContain("width:");
});

test("퍼널 데이터가 없으면 카드를 렌더링하지 않는다", () => {
  expect(renderToStaticMarkup(<AccountFunnelCard funnel={null} />)).toBe("");
});

// ── 신청 구간 ─────────────────────────────────────────────────────────

test("신청 폼 미연동이면 신청 구간을 그리지 않는다", () => {
  const html = renderToStaticMarkup(<AccountFunnelCard funnel={funnel} />);

  expect(html).not.toContain("지원 신청");
});

test("연동돼 있으면 신청 수와 클릭 대비 전환율을 보여준다", () => {
  const html = renderToStaticMarkup(
    <AccountFunnelCard
      funnel={{
        ...funnel,
        applications: 5,
        bioApplications: 4,
        applyRate: 12.9,
        applicationsByMedium: { bio: 4, paid: 1 },
      }}
    />,
  );

  expect(html).toContain("지원 신청");
  expect(html).toContain("12.90%");
});

test("신청은 있는데 링크 클릭이 미측정이면 전환율 자리를 비운다", () => {
  const html = renderToStaticMarkup(
    <AccountFunnelCard
      funnel={{
        ...funnel,
        websiteClicks: null,
        applications: 5,
        bioApplications: 4,
        applyRate: null,
        applicationsByMedium: { bio: 4 },
      }}
    />,
  );

  expect(html).toContain("지원 신청");
  expect(html).toContain("신청 전환율 미측정");
});

test("바이오 밖 유입이 섞이면 분자가 바이오만임을 밝힌다", () => {
  // 사용자가 5건을 보고 24클릭으로 나눠 계산하면 대시보드 수치와 어긋난다.
  // 분모에 없는 유입이 있다는 사실을 숫자 옆에 남겨야 오해가 없다.
  const html = renderToStaticMarkup(
    <AccountFunnelCard
      funnel={{
        ...funnel,
        applications: 5,
        bioApplications: 4,
        applyRate: 16.67,
        applicationsByMedium: { bio: 4, paid: 1 },
      }}
    />,
  );

  expect(html).toContain("바이오 4건");
});
