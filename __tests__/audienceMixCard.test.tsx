import { renderToStaticMarkup } from "react-dom/server";
import { AudienceMixCard } from "@/components/AudienceMixCard";
import type { AudienceMix } from "@/lib/analysis/audienceMix";
import type { Reel } from "@/lib/schemas";

const mix: AudienceMix = {
  followerReach: 227,
  nonFollowerReach: 2847,
  total: 3074,
  nonFollowerShare: 92.62,
  date: "2026-07-30",
};

function reel(p: Partial<Reel>): Reel {
  return {
    id: "r", postedAt: "2026-06-01T00:00:00Z", durationSec: 30,
    views: 0, reach: 0, likes: 0, comments: 0, saves: 0, shares: 0, avgWatchTimeSec: 0,
    ...p,
  };
}

const reels = [reel({ likes: 100, comments: 20, saves: 30, shares: 50 })];

test("도달 구성과 인게이지먼트 구성을 한 카드에 담는다", () => {
  const html = renderToStaticMarkup(<AudienceMixCard mix={mix} reels={reels} />);

  // 카드 껍데기는 하나 — 두 섹션이 같은 카드 안에 있어야 한다.
  expect(html.match(/rounded-card/g)?.length).toBe(1);
  expect(html).toContain("도달 구성");
  expect(html).toContain("인게이지먼트 구성");
  expect(html).toContain("2,847");
  expect(html).toContain("92.62%");
});

test("도달 구성 데이터가 없어도 인게이지먼트 구성은 남는다", () => {
  const html = renderToStaticMarkup(<AudienceMixCard mix={null} reels={reels} />);

  expect(html).toContain("인게이지먼트 구성");
  expect(html).not.toContain("비팔로워 (신규 도달)");
});

test("둘 다 없으면 카드를 렌더링하지 않는다", () => {
  expect(renderToStaticMarkup(<AudienceMixCard mix={null} reels={[]} />)).toBe("");
});
