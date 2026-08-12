import { expect, test } from "vitest";
import { parseInstagramPreview, isInstagramPostUrl } from "@/lib/instagram/preview";

// 실제 응답에서 추린 형태. 인스타는 값을 HTML 엔티티로 이스케이프해서 보낸다.
const html = `<!DOCTYPE html><html><head>
<meta property="og:title" content="&#xb514;&#xc6d0; | 1&#xc778; &#xcc3d;&#xc5c5;&#xac00;&#xb97c; &#xc704;&#xd55c; &#xcee4;&#xbba4;&#xb2c8;&#xd2f0;" />
<meta property="og:image" content="https://scontent-icn2-1.cdninstagram.com/v/t51.82787-15/731584155_178888.jpg?stp=dst-jpg&amp;_nc_ht=x" />
<meta property="og:description" content="wearedone.kr on June 27, 2026: &quot;&#x201d;&#xc81c;&#xac00; &#xb2e4;&#xc2dc;&#x201d;&quot;" />
</head><body></body></html>`;

test("썸네일과 계정 핸들과 표시 이름을 뽑는다", () => {
  const preview = parseInstagramPreview(html);

  expect(preview.thumbnailUrl).toBe(
    "https://scontent-icn2-1.cdninstagram.com/v/t51.82787-15/731584155_178888.jpg?stp=dst-jpg&_nc_ht=x",
  );
  expect(preview.handle).toBe("wearedone.kr");
  expect(preview.displayName).toBe("디원");
});

test("엔티티로 온 한글을 되돌린다", () => {
  const preview = parseInstagramPreview(html);

  // &#xb514; 같은 값을 그대로 두면 화면에 코드가 찍힌다.
  expect(preview.displayName).not.toContain("&#x");
  expect(preview.caption).toContain("제가 다시");
});

test("og 태그가 없으면 빈 미리보기를 준다", () => {
  const preview = parseInstagramPreview("<html><head><title>Instagram</title></head></html>");

  expect(preview.thumbnailUrl).toBeNull();
  expect(preview.handle).toBeNull();
});

test("표시 이름에 구분자가 없으면 통째로 쓴다", () => {
  const simple = `<meta property="og:title" content="Some Account" />`;

  expect(parseInstagramPreview(simple).displayName).toBe("Some Account");
});

test("설명이 예상 형태가 아니면 핸들을 억지로 만들지 않는다", () => {
  const odd = `<meta property="og:description" content="좋아요 1,234개" />`;

  expect(parseInstagramPreview(odd).handle).toBeNull();
});

test("인스타그램 게시물 주소만 받는다", () => {
  expect(isInstagramPostUrl("https://www.instagram.com/reel/DaHTOWLh-Jw/")).toBe(true);
  expect(isInstagramPostUrl("https://instagram.com/p/ABC123/")).toBe(true);
  expect(isInstagramPostUrl("https://www.instagram.com/wearedone.kr/")).toBe(false);
  expect(isInstagramPostUrl("https://evil.com/reel/x/")).toBe(false);
  // 서버가 이 주소로 요청을 보내므로 사내망·로컬을 겨누지 못하게 막는다.
  expect(isInstagramPostUrl("http://localhost/reel/x/")).toBe(false);
  expect(isInstagramPostUrl("not a url")).toBe(false);
});

// 인스타는 Accept-Language에 따라 형식을 바꾼다. 한국어로 오면 구분자가
// " on "이 아니라 " - "이고 제목이 "Instagram의 X"가 된다. 요청은 영어로
// 고정하지만, 형식이 흔들려도 핸들을 놓치지 않게 양쪽을 다 받는다.
test("한국어 형식으로 와도 핸들을 뽑는다", () => {
  const ko = `<meta property="og:description" content="wearedone.kr - June 27, 2026: &quot;제가 다시&quot;" />`;

  expect(parseInstagramPreview(ko).handle).toBe("wearedone.kr");
});

test("제목이 'Instagram의 X' 꼴이면 계정 이름만 남긴다", () => {
  const ko = `<meta property="og:title" content="Instagram&#xc758; &#xb514;&#xc6d0;" />`;

  expect(parseInstagramPreview(ko).displayName).toBe("디원");
});

test("영문 제목의 Instagram 접두사도 걷어낸다", () => {
  const en = `<meta property="og:title" content="디원 on Instagram" />`;

  expect(parseInstagramPreview(en).displayName).toBe("디원");
});
