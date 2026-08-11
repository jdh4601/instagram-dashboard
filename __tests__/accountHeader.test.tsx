import { renderToStaticMarkup } from "react-dom/server";
import { AccountHeader } from "@/components/AccountHeader";
import type { AccountProfile } from "@/lib/schemas";

function profile(overrides: Partial<AccountProfile> = {}): AccountProfile {
  return {
    username: "wearedone.kr",
    displayName: "디원 | 1인 창업가를 위한 커뮤니티",
    biography: "여러분이 아직 몰랐던 1인 창업가\n1,000명의 성공 사례를 기록하고 있습니다 🚀\n👇 D.one Club 사전 신청",
    avatarUrl: "https://cdn/a.jpg",
    followersCount: 306,
    mediaCount: 27,
    updatedAt: "2026-07-31",
    ...overrides,
  };
}

test("헤더는 표시 이름과 바이오를 사용자명 아래에 함께 보여준다", () => {
  const html = renderToStaticMarkup(
    <AccountHeader profile={profile()} followerDelta={null} contentCount={27} />,
  );

  expect(html).toContain("@wearedone.kr");
  expect(html).toContain("디원 | 1인 창업가를 위한 커뮤니티");
  expect(html).toContain("여러분이 아직 몰랐던 1인 창업가");
  expect(html).toContain("👇 D.one Club 사전 신청");
});

test("바이오의 줄바꿈은 인스타그램처럼 그대로 유지된다", () => {
  const html = renderToStaticMarkup(
    <AccountHeader profile={profile()} followerDelta={null} contentCount={27} />,
  );

  // 줄바꿈을 <br>로 바꾸지 않고 CSS로 살린다 — 원문을 그대로 담아야 복사·검색이 된다.
  expect(html).toContain("whitespace-pre-line");
  expect(html).toContain("1인 창업가\n1,000명의");
});

test("바이오가 없으면 빈 줄을 만들지 않는다", () => {
  const html = renderToStaticMarkup(
    <AccountHeader
      profile={profile({ biography: undefined, displayName: undefined })}
      followerDelta={null}
      contentCount={27}
    />,
  );

  expect(html).toContain("@wearedone.kr");
  expect(html).not.toContain("whitespace-pre-line");
});

test("계정이 연결되지 않아도 헤더는 렌더링된다", () => {
  const html = renderToStaticMarkup(
    <AccountHeader profile={null} followerDelta={null} contentCount={0} />,
  );

  expect(html).toContain("계정 미연결");
});
