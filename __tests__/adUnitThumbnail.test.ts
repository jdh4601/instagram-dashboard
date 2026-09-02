import { resolveAdUnitThumbnails } from "@/lib/ads/thumbnail";
import type { AdUnit } from "@/lib/ads/adUnit";

function unit(over: Partial<AdUnit> = {}): AdUnit {
  return {
    adId: "ad1",
    name: "광고",
    status: "ACTIVE",
    mediaId: "18102344906618669",
    thumbnailUrl: "https://scontent.example/meta-logo.jpg",
    spend: 1000,
    impressions: 100,
    reach: 90,
    clicks: 10,
    goal: "THRUPLAY",
    results: null,
    costPerResult: null,
    budget: null,
    activity: [],
    engagements: null,
    hasDelivery: true,
    ...over,
  };
}

test("인스타그램이 준 썸네일로 갈아 끼운다", async () => {
  const [resolved] = await resolveAdUnitThumbnails(
    [unit()],
    async () => "https://cdninstagram.example/reel-frame.jpg",
  );

  expect(resolved.thumbnailUrl).toBe("https://cdninstagram.example/reel-frame.jpg");
});

// Meta가 주는 크리에이티브 이미지는 페이지 로고인 경우가 있다. 로고라도 빈칸보다는
// 나으므로 버리지 않고 그대로 남긴다.
test("인스타그램이 답하지 못하면 Meta 이미지를 그대로 둔다", async () => {
  const [nullish] = await resolveAdUnitThumbnails([unit()], async () => null);
  expect(nullish.thumbnailUrl).toBe("https://scontent.example/meta-logo.jpg");

  const [thrown] = await resolveAdUnitThumbnails([unit()], async () => {
    throw new Error("토큰 만료");
  });
  expect(thrown.thumbnailUrl).toBe("https://scontent.example/meta-logo.jpg");
});

test("게시물 id가 없는 광고는 묻지 않는다", async () => {
  const asked: string[] = [];

  await resolveAdUnitThumbnails([unit({ mediaId: undefined })], async (mediaId) => {
    asked.push(mediaId);
    return null;
  });

  expect(asked).toEqual([]);
});

// 한 게시물을 여러 번 태우면 광고마다 같은 미디어를 가리킨다. 광고 수만큼 물으면
// 목록 한 번 여는 데 요청이 배로 늘어난다.
test("같은 게시물을 가리키는 광고들은 한 번만 묻는다", async () => {
  const asked: string[] = [];

  const resolved = await resolveAdUnitThumbnails(
    [unit({ adId: "a" }), unit({ adId: "b" }), unit({ adId: "c", mediaId: "다른id" })],
    async (mediaId) => {
      asked.push(mediaId);
      return `https://cdninstagram.example/${mediaId}.jpg`;
    },
  );

  expect(asked.sort()).toEqual(["18102344906618669", "다른id"]);
  expect(resolved[0].thumbnailUrl).toBe("https://cdninstagram.example/18102344906618669.jpg");
  expect(resolved[1].thumbnailUrl).toBe("https://cdninstagram.example/18102344906618669.jpg");
});

test("광고 순서는 그대로 둔다", async () => {
  const resolved = await resolveAdUnitThumbnails(
    [unit({ adId: "a", spend: 300 }), unit({ adId: "b", spend: 100 })],
    async () => null,
  );

  expect(resolved.map((row) => row.adId)).toEqual(["a", "b"]);
});
