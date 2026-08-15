import { renderToStaticMarkup } from "react-dom/server";
import { HookForm } from "@/components/HookForm";
import type { Hook } from "@/lib/schemas";

const hook: Hook = {
  id: "h1",
  text: "이걸 모르면 1년을 날립니다",
  category: "contrarian",
  sourceUrl: "https://www.instagram.com/reel/abc/",
  note: "카탈로그: 역발상",
  isFavorite: true,
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
};

test("수정 폼은 담아 둔 값을 그대로 채워서 연다", () => {
  const html = renderToStaticMarkup(
    <HookForm editing={hook} onSubmit={async () => undefined} onCancel={() => undefined} />,
  );

  expect(html).toContain('aria-label="훅 수정"');
  expect(html).toContain('value="이걸 모르면 1년을 날립니다"');
  expect(html).toContain('value="https://www.instagram.com/reel/abc/"');
  expect(html).toContain('value="카탈로그: 역발상"');
});

test("폼이 열리면 첫 칸에 커서를 둔다", () => {
  // 목록 한가운데서 수정을 누르면 폼이 어디에 열렸는지 알 수 없다. 커서가 옮겨가야
  // 폼이 열렸다는 걸 알아차린다.
  const html = renderToStaticMarkup(
    <HookForm editing={hook} onSubmit={async () => undefined} onCancel={() => undefined} />,
  );

  expect(html).toContain("autofocus");
});

test("새 훅 추가 폼은 빈 값으로 연다", () => {
  const html = renderToStaticMarkup(
    <HookForm editing={null} onSubmit={async () => undefined} onCancel={() => undefined} />,
  );

  expect(html).toContain('aria-label="훅 추가"');
  expect(html).toContain('value=""');
});
