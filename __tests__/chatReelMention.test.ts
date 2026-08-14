import { findMentionedReels, selectContextReels, MAX_MENTIONED_REELS } from "@/lib/chat/reelMention";
import type { Reel } from "@/lib/schemas";

function reel(id: string, caption: string, postedAt = "2026-07-20T09:00:00Z"): Reel {
  return {
    id,
    postedAt,
    durationSec: 30,
    views: 1000,
    reach: 800,
    likes: 20,
    comments: 2,
    saves: 4,
    shares: 6,
    avgWatchTimeSec: 10,
    caption,
  };
}

const reels = [
  reel("17908390791446343", "혼자 창업하는 사람들이 가장 어려워하는 게 뭘까요"),
  reel("18550142134073665", "창업가가 가격을 정할 때 꼭 알아야 할 것들 4가지"),
  reel("18116210029810012", "번아웃이 오면 무조건 쉬어야 하는 이유"),
];

test("메시지에 릴스 ID가 그대로 들어 있으면 그 릴스를 찾는다", () => {
  const found = findMentionedReels("18550142134073665 이거 왜 성과가 나빴어?", reels);
  expect(found.map((r) => r.id)).toEqual(["18550142134073665"]);
});

test("캡션 키워드가 겹치면 해당 릴스를 찾는다", () => {
  const found = findMentionedReels("가격 정하는 콘텐츠 성과 어땠어?", reels);
  expect(found[0]?.id).toBe("18550142134073665");
});

test("관련 없는 질문에는 아무 릴스도 딸려가지 않는다", () => {
  // 일반 질문에 엉뚱한 릴스가 붙으면 모델이 그 릴스를 질문 대상으로 오해한다.
  expect(findMentionedReels("내 계정 병목이 어디야?", reels)).toEqual([]);
});

test("빈 메시지나 게시물이 없을 때도 안전하게 빈 배열을 준다", () => {
  expect(findMentionedReels("", reels)).toEqual([]);
  expect(findMentionedReels("가격 콘텐츠", [])).toEqual([]);
});

test(`아무리 많이 걸려도 ${MAX_MENTIONED_REELS}개까지만 확장한다`, () => {
  const many = Array.from({ length: 10 }, (_, i) =>
    reel(`id-${i}`, "창업가 가격 번아웃 성장 인터뷰"),
  );
  const found = findMentionedReels("창업가 가격 번아웃 성장 인터뷰 이야기", many);
  expect(found.length).toBeLessThanOrEqual(MAX_MENTIONED_REELS);
});

test("한 글자짜리 우연한 겹침으로는 매칭되지 않는다", () => {
  // "왜"·"이"처럼 흔한 조각이 매칭을 만들면 모든 질문에 릴스가 딸려간다.
  expect(findMentionedReels("이 계정 왜 이래?", reels)).toEqual([]);
});

describe("보고 있는 릴스 합치기", () => {
  test("열어 둔 릴스는 질문이 지목하지 않아도 컨텍스트에 들어간다", () => {
    const picked = selectContextReels("이거 훅 왜 약해?", "18116210029810012", reels);
    expect(picked.map((r) => r.id)).toEqual(["18116210029810012"]);
  });

  test("열어 둔 릴스가 먼저 오고 지목된 릴스가 뒤따른다", () => {
    const picked = selectContextReels("가격 정할 때 얘기는 어땠어?", "18116210029810012", reels);
    expect(picked.map((r) => r.id)).toEqual(["18116210029810012", "18550142134073665"]);
  });

  test("열어 둔 릴스를 질문이 또 지목해도 한 번만 싣는다", () => {
    const picked = selectContextReels("가격 정할 때 얘기", "18550142134073665", reels);
    expect(picked.map((r) => r.id)).toEqual(["18550142134073665"]);
  });

  test("보고 있는 릴스가 없으면 지목 결과와 같다", () => {
    expect(selectContextReels("가격 정할 때 얘기", null, reels)).toEqual(
      findMentionedReels("가격 정할 때 얘기", reels),
    );
  });

  test("저장소에 없는 id는 조용히 무시한다", () => {
    expect(selectContextReels("내 계정 병목이 어디야?", "없는-릴스", reels)).toEqual([]);
  });

  test(`합쳐도 ${MAX_MENTIONED_REELS}개를 넘지 않는다`, () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      reel(`id-${i}`, "창업가 가격 번아웃 성장 인터뷰"),
    );
    const picked = selectContextReels("창업가 가격 번아웃 성장 인터뷰 이야기", "id-9", many);
    expect(picked.length).toBeLessThanOrEqual(MAX_MENTIONED_REELS);
  });
});
