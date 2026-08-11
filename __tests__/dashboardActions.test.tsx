import { renderToStaticMarkup } from "react-dom/server";
import { DashboardActions } from "@/components/DashboardActions";

const NOW = new Date("2026-08-11T14:00:00+09:00");

function render(lastSyncedAt: string | null) {
  return renderToStaticMarkup(
    <DashboardActions onSync={() => {}} syncing={false} lastSyncedAt={lastSyncedAt} now={NOW} />,
  );
}

test("동기화 시각이 있으면 버튼 옆에 상대 시간을 보여준다", () => {
  const html = render("2026-08-11T11:00:00+09:00");

  expect(html).toContain("3시간 전 동기화");
});

test("한 번도 동기화하지 않았으면 신선도 문구를 보여주지 않는다", () => {
  const html = render(null);

  expect(html).not.toContain("전 동기화");
  expect(html).not.toContain("방금 동기화");
  // 동기화 버튼 자체는 그대로 있다
  expect(html).toContain("동기화");
});

test("상대 시간은 동기화 버튼보다 앞에 온다", () => {
  const html = render("2026-08-11T11:00:00+09:00");

  // primary variant는 동기화 버튼에만 붙는다(테마 토글·설정 링크와 구분되는 표식).
  expect(html.indexOf("3시간 전 동기화")).toBeLessThan(html.indexOf("bg-brand-600"));
});
