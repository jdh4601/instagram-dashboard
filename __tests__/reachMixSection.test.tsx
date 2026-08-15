import { renderToStaticMarkup } from "react-dom/server";
import { ReachMixSection } from "@/components/ReachMixSection";
import type { AudienceMix } from "@/lib/analysis/audienceMix";

const mix: AudienceMix = {
  followerReach: 227,
  nonFollowerReach: 2847,
  total: 3074,
  nonFollowerShare: 92.62,
  date: "2026-07-30",
};

test("팔로워와 비팔로워 도달을 수치와 비율로 나눠 보여준다", () => {
  const html = renderToStaticMarkup(<ReachMixSection mix={mix} />);

  expect(html).toContain("도달 구성");
  expect(html).toContain("2,847");
  expect(html).toContain("92.62%");
  expect(html).toContain("227");
  expect(html).toContain("7.38%");
});

test("카드 껍데기를 두르지 않는다", () => {
  // 업로드 리듬 카드 안에 얹히는 섹션이다. 여기서 카드를 또 그리면 카드 속 카드가 된다.
  const html = renderToStaticMarkup(<ReachMixSection mix={mix} />);

  expect(html).not.toContain("rounded-card");
  expect(html.startsWith("<section")).toBe(true);
});

test("인게이지먼트 구성 도넛은 더 이상 그리지 않는다", () => {
  // 좋아요·저장·공유 비율은 어느 게시물을 고쳐야 하는지 말해 주지 않아 걷어냈다.
  expect(renderToStaticMarkup(<ReachMixSection mix={mix} />)).not.toContain("인게이지먼트");
});
