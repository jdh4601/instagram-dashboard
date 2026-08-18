vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { renderToStaticMarkup } from "react-dom/server";
import { ReelBreakdownReport, formatBreakdownTime } from "@/components/ReelBreakdownReport";
import { HOOK_CATEGORY_LABELS, type Hook } from "@/lib/schemas";

const hook: Hook = {
  id: "h1",
  text: "AI가 가상 스튜디오를 만들었습니다",
  category: "curiosity",
  sourceUrl: "https://www.instagram.com/reel/abc/",
  thumbnailUrl: "https://cdn.example.com/thumb.jpg",
  isFavorite: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  breakdown: {
    reelUrl: "https://www.instagram.com/reel/abc/",
    assetKey: "asset",
    durationSec: 10,
    cuts: [2, 4],
    hookType: "authority",
    beats: Array.from({ length: 5 }, (_, index) => ({
      start: index * 2,
      end: (index + 1) * 2,
      label: index === 0 ? "훅" : `구간 ${index + 1}`,
      scene: "제품 화면과 화자가 함께 나온다",
      original: `Original ${index + 1}`,
      translation: `번역 ${index + 1}`,
      clipFile: `${index + 1}`.padStart(2, "0") + ".mp4",
      posterFile: `${index + 1}`.padStart(4, "0") + ".jpg",
    })),
    generatedAt: "2026-08-15T00:00:00.000Z",
  },
};

test("해체 리포트는 저장 분류·영상에서 본 훅 분류·모든 비트를 보여준다", () => {
  const html = renderToStaticMarkup(<ReelBreakdownReport hook={hook} />);

  expect(html).toContain("호기심");
  expect(html).toContain("권위·근거");
  expect(html).toContain("The Authority");
  expect(html).toContain("번역 5");
  expect(html).toContain("/api/hooks/h1/breakdown/assets/clips/01.mp4");
});

test("훅 분류는 보관함과 같은 5칸만 늘어놓는다", () => {
  const html = renderToStaticMarkup(<ReelBreakdownReport hook={hook} />);

  for (const label of Object.values(HOOK_CATEGORY_LABELS)) expect(html).toContain(label);
  // 예전 16종의 잔재가 남아 있으면 고를 것이 다시 많아진다.
  expect(html).not.toContain("부정 선언형");
  expect(html).not.toContain("스케일 선언형");
});

test("구간 라벨은 배경 없이 흰 글씨로만 찍지 않는다", () => {
  // 다크 테마의 neutral-900은 거의 흰색이라 흰 글씨를 얹으면 라벨이 사라졌다.
  const html = renderToStaticMarkup(<ReelBreakdownReport hook={hook} />);

  expect(html).not.toContain("text-white bg-neutral-900");
  expect(html).toContain("bg-surface-muted text-neutral-700");
});

test("스토리텔링 유형은 포맷 이름과 표준 비트를 함께 보여준다", () => {
  const withFormat = {
    ...hook,
    breakdown: { ...hook.breakdown!, storyFormatId: "heros-journey" },
  } satisfies Hook;
  const html = renderToStaticMarkup(<ReelBreakdownReport hook={withFormat} />);

  expect(html).toContain("스토리텔링 유형");
  expect(html).toContain("히어로즈 저니 (1인칭 문제 해결)");
  expect(html).toContain("변곡점");
  expect(html).toContain('href="/story-formats/heros-journey"');
});

test("포맷 판정이 없던 옛 해체 결과는 무엇을 하면 되는지 알려준다", () => {
  const html = renderToStaticMarkup(<ReelBreakdownReport hook={hook} />);

  expect(html).toContain("다시 해체하기를 누르면 채워집니다");
});

test("초를 넘김 없이 mm:ss로 표시한다", () => {
  expect(formatBreakdownTime(59.8)).toBe("1:00");
  expect(formatBreakdownTime(61)).toBe("1:01");
});
