import { ReelSchema, type Reel } from "@/lib/schemas";
import { mediaKindOf } from "@/lib/media/kind";

const base = {
  id: "r1",
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
  avgWatchTimeSec: 10,
};

test("mediaType이 없는 기존 데이터는 그대로 파싱되고 릴스로 읽힌다", () => {
  const parsed = ReelSchema.parse(base);
  expect(parsed.mediaType).toBeUndefined();
  expect(mediaKindOf(parsed)).toBe("REELS");
});

test("mediaType이 CAROUSEL이면 캐러셀로 읽힌다", () => {
  const parsed = ReelSchema.parse({ ...base, mediaType: "CAROUSEL" });
  expect(mediaKindOf(parsed)).toBe("CAROUSEL");
});

test("알 수 없는 mediaType은 파싱을 거부한다", () => {
  expect(() => ReelSchema.parse({ ...base, mediaType: "STORY" })).toThrow();
});

test("mediaKindOf는 명시된 REELS도 그대로 돌려준다", () => {
  const reel: Reel = { ...base, mediaType: "REELS" };
  expect(mediaKindOf(reel)).toBe("REELS");
});
