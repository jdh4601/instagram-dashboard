// reels/[id] 상세 라우트 테스트. 저장소는 mock으로 대체한다.
jest.mock("@/lib/store", () => ({
  getRepository: jest.fn(),
  getReelHistoryRepository: jest.fn(),
}));

import { GET } from "@/app/api/reels/[id]/route";
import { getRepository, getReelHistoryRepository } from "@/lib/store";
import type { Reel } from "@/lib/schemas";

const mockGetRepository = getRepository as unknown as jest.Mock;
const mockGetHistoryRepository = getReelHistoryRepository as unknown as jest.Mock;

const base = {
  durationSec: 0,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
  avgWatchTimeSec: 0,
};

const reels: Reel[] = [
  { ...base, id: "릴스-1", postedAt: "2026-06-01T00:00:00Z", mediaType: "REELS" },
  { ...base, id: "캐러셀-1", postedAt: "2026-06-02T00:00:00Z", mediaType: "CAROUSEL" },
  { ...base, id: "릴스-2", postedAt: "2026-06-03T00:00:00Z", mediaType: "REELS" },
  { ...base, id: "캐러셀-2", postedAt: "2026-06-04T00:00:00Z", mediaType: "CAROUSEL" },
];

const fakeRepo = {
  list: jest.fn(async () => reels),
  get: jest.fn(async (id: string) => reels.find((r) => r.id === id) ?? null),
};
const fakeHistoryRepo = { list: jest.fn(async () => []) };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRepository.mockReturnValue(fakeRepo);
  mockGetHistoryRepository.mockReturnValue(fakeHistoryRepo);
});

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

async function detail(id: string) {
  const res = await GET(new Request(`http://localhost:3000/api/reels/${id}`), ctx(id));
  return { status: res.status, body: await res.json() };
}

test("이전·다음 이동은 같은 미디어 종류 안에서만 이뤄진다", async () => {
  const { body } = await detail("캐러셀-2");
  expect(body.nav.prevId).toBe("캐러셀-1");
  expect(body.nav.nextId).toBeNull();
});

test("릴스의 이전 게시물은 중간의 캐러셀을 건너뛴다", async () => {
  const { body } = await detail("릴스-2");
  expect(body.nav.prevId).toBe("릴스-1");
});

test("캐러셀 진단에는 훅 잔존·평균 시청 비율 판정이 들어가지 않는다", async () => {
  const { body } = await detail("캐러셀-1");
  const keys = body.analysis.diagnosis.verdicts.map((v: { key: string }) => v.key);
  expect(keys).not.toContain("hookRetention3s");
  expect(keys).not.toContain("completionRate");
  expect(keys).toContain("shareRate");
});

test("없는 id는 404", async () => {
  const { status } = await detail("없는-id");
  expect(status).toBe(404);
});
