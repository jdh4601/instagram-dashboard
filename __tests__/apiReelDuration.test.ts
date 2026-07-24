// 영상 길이 수동 입력(PATCH) 테스트. Graph API가 길이를 주지 않아 사용자가 채운다.
jest.mock("@/lib/store", () => ({
  getRepository: jest.fn(),
  getReelHistoryRepository: jest.fn(),
}));

import { PATCH } from "@/app/api/reels/[id]/route";
import { getRepository } from "@/lib/store";
import { computeDerivedRates } from "@/lib/analysis/metrics";
import { diagnose } from "@/lib/analysis/diagnosis";
import type { Reel } from "@/lib/schemas";

const mockGetRepository = getRepository as unknown as jest.Mock;

const reel: Reel = {
  id: "릴스-1",
  mediaType: "REELS",
  postedAt: "2026-07-20T00:00:00Z",
  durationSec: 0,
  views: 1200,
  reach: 929,
  likes: 15,
  comments: 1,
  saves: 6,
  shares: 2,
  avgWatchTimeSec: 6.5,
  hookRetention3s: 31.5,
  transcript: [{ startSec: 0, endSec: 2, text: "훅" }],
};

let stored: Reel;
const fakeRepo = {
  get: jest.fn(async (id: string) => (id === reel.id ? stored : null)),
  upsert: jest.fn(async (next: Reel) => {
    stored = next;
    return next;
  }),
};

beforeEach(() => {
  jest.clearAllMocks();
  stored = { ...reel };
  mockGetRepository.mockReturnValue(fakeRepo);
});

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

async function patch(id: string, body: unknown) {
  const res = await PATCH(
    new Request(`http://localhost:3000/api/reels/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
  return { status: res.status, body: await res.json() };
}

test("영상 길이를 저장한다", async () => {
  const { status } = await patch(reel.id, { durationSec: 15 });
  expect(status).toBe(200);
  expect(stored.durationSec).toBe(15);
});

test("길이를 저장하면 파생 지표도 함께 갱신된다", async () => {
  await patch(reel.id, { durationSec: 15 });
  // 평균 시청 6.5초 / 영상 15초 = 43.3%
  expect(stored.derived?.completionRate).toBeCloseTo((6.5 / 15) * 100, 5);
});

test("길이 외 다른 필드는 건드리지 않는다", async () => {
  await patch(reel.id, { durationSec: 15, views: 99999, transcript: [] });
  expect(stored.views).toBe(1200);
  expect(stored.transcript).toHaveLength(1);
});

test("길이가 들어오면 시청 완료율이 진단에 합류한다", async () => {
  const before = diagnose(stored).verdicts.map((v) => v.key);
  expect(before).not.toContain("completionRate");

  await patch(reel.id, { durationSec: 15 });

  const after = diagnose(stored).verdicts.map((v) => v.key);
  expect(after).toContain("completionRate");
});

test("완료율은 평균 시청 ÷ 영상 길이다", () => {
  const d = computeDerivedRates({ ...reel, durationSec: 60 });
  // 6.5 / 60 = 10.8% — 같은 6.5초라도 60초 영상이면 폐기 수준이다
  expect(d.completionRate).toBeCloseTo((6.5 / 60) * 100, 5);
});

test.each([
  ["0 이하", 0],
  ["음수", -5],
  ["숫자가 아님", "십오초"],
  ["과도하게 김", 100_000],
])("잘못된 길이(%s)는 400", async (_label, durationSec) => {
  const { status } = await patch(reel.id, { durationSec });
  expect(status).toBe(400);
  expect(stored.durationSec).toBe(0);
});

test("없는 id는 404", async () => {
  const { status } = await patch("없는-id", { durationSec: 15 });
  expect(status).toBe(404);
});
