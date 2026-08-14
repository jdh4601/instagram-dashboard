import { renderToStaticMarkup } from "react-dom/server";
import { Sidebar } from "@/components/Sidebar";

test("사이드바는 여섯 개 탭을 모두 링크로 그린다", () => {
  const html = renderToStaticMarkup(<Sidebar pathname="/" />);

  expect(html).toContain('href="/"');
  expect(html).toContain('href="/reels"');
  expect(html).toContain('href="/carousels"');
  expect(html).toContain('href="/hooks"');
  expect(html).toContain('href="/story-formats"');
  expect(html).toContain('href="/settings"');
  expect(html).toContain("대시보드");
  expect(html).toContain("캐러셀");
  expect(html).toContain("훅 저장소");
  expect(html).toContain("스토리텔링 포맷");
});

test("현재 페이지 탭에만 aria-current를 붙인다", () => {
  const html = renderToStaticMarkup(<Sidebar pathname="/hooks" />);

  const currents = html.match(/aria-current="page"/g) ?? [];
  expect(currents).toHaveLength(1);
  // aria-current가 붙은 링크가 /hooks인지 확인한다.
  expect(html).toMatch(/href="\/hooks"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/hooks"/);
});

test("캐러셀 페이지에서는 캐러셀 탭만 활성이다", () => {
  const html = renderToStaticMarkup(<Sidebar pathname="/carousels" />);

  const currents = html.match(/aria-current="page"/g) ?? [];
  expect(currents).toHaveLength(1);
  expect(html).toMatch(
    /href="\/carousels"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/carousels"/,
  );
});

test("릴스 상세에서도 릴스 탭이 활성으로 남는다", () => {
  const html = renderToStaticMarkup(<Sidebar pathname="/reel/17900000000000000" />);

  expect(html).toMatch(/href="\/reels"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/reels"/);
});

test("사이드바는 내비게이션 랜드마크로 읽힌다", () => {
  const html = renderToStaticMarkup(<Sidebar pathname="/" />);

  expect(html).toContain("<nav");
  expect(html).toContain('aria-label="주요 메뉴"');
});
