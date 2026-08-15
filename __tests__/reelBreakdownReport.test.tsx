vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { renderToStaticMarkup } from "react-dom/server";
import { ReelBreakdownReport, formatBreakdownTime } from "@/components/ReelBreakdownReport";
import type { Hook } from "@/lib/schemas";

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
    hookType: "declaration",
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

test("해체 리포트는 저장 분류·상세 훅 분류·모든 비트를 보여준다", () => {
  const html = renderToStaticMarkup(<ReelBreakdownReport hook={hook} />);

  expect(html).toContain("호기심");
  expect(html).toContain("스케일 선언형");
  expect(html).toContain("The Scale Declaration");
  expect(html).toContain("번역 5");
  expect(html).toContain("/api/hooks/h1/breakdown/assets/clips/01.mp4");
});

test("초를 넘김 없이 mm:ss로 표시한다", () => {
  expect(formatBreakdownTime(59.8)).toBe("1:00");
  expect(formatBreakdownTime(61)).toBe("1:01");
});
