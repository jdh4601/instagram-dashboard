import { renderToStaticMarkup } from "react-dom/server";
import { AudienceMixCard } from "@/components/AudienceMixCard";
import type { AudienceMix } from "@/lib/analysis/audienceMix";

const mix: AudienceMix = {
  followerReach: 227,
  nonFollowerReach: 2847,
  total: 3074,
  nonFollowerShare: 92.62,
  date: "2026-07-30",
};

test("도달 구성만 담는다", () => {
  const html = renderToStaticMarkup(<AudienceMixCard mix={mix} />);

  expect(html.match(/rounded-card/g)?.length).toBe(1);
  expect(html).toContain("도달 구성");
  expect(html).toContain("2,847");
  expect(html).toContain("92.62%");
});

test("인게이지먼트 구성 도넛은 더 이상 그리지 않는다", () => {
  // 좋아요·저장·공유 비율은 어느 게시물을 고쳐야 하는지 말해 주지 않아 걷어냈다.
  const html = renderToStaticMarkup(<AudienceMixCard mix={mix} />);

  expect(html).not.toContain("인게이지먼트");
});

test("도달 구성 데이터가 없으면 카드를 렌더링하지 않는다", () => {
  expect(renderToStaticMarkup(<AudienceMixCard mix={null} />)).toBe("");
});
