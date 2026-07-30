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
