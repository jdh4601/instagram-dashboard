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

// 개인화 베이스라인은 BASELINE_MIN_REELS(5) 이상일 때만 켜진다. 캐러셀 6건(대상 포함)과
// 릴스 5건을 두어, 베이스라인이 릴스로 오염되면 대상 캐러셀의 공유율 판정이
// "적정"에서 "강점"으로 뒤집히도록 지표를 벌려 놓았다.
//   동종 기준: 다른 캐러셀 5건이 모두 1.0% → 중앙값 1.0 → 적정 구간 0.85~1.15 → 대상 0.9%는 "적정"
//   오염 시:   릴스 5건(0.1%)이 섞여 중앙값 0.55 → 강점 기준 0.63 → 대상 0.9%가 "강점"
const shareRateReel = (id: string, day: number, shares: number, mediaType: "REELS" | "CAROUSEL"): Reel => ({
  ...base,
  id,
  postedAt: `2026-07-${String(day).padStart(2, "0")}T00:00:00Z`,
  mediaType,
  views: 1000,
  shares,
});

test("베이스라인은 같은 종류만 쓴다 — 릴스가 섞이면 캐러셀 판정이 뒤집힌다", async () => {
  const carousels = [
    shareRateReel("캐러셀-대상", 1, 9, "CAROUSEL"),
    ...[2, 3, 4, 5, 6].map((day) => shareRateReel(`캐러셀-${day}`, day, 10, "CAROUSEL")),
  ];
  const lowShareReels = [11, 12, 13, 14, 15].map((day) =>
    shareRateReel(`릴스-${day}`, day, 1, "REELS"),
  );
  const mixed = [...carousels, ...lowShareReels];
  mockGetRepository.mockReturnValue({
    list: jest.fn(async () => mixed),
    get: jest.fn(async (id: string) => mixed.find((r) => r.id === id) ?? null),
  });

  const { body } = await detail("캐러셀-대상");

  expect(body.analysis.baselineActive).toBe(true);
  const shareVerdict = body.analysis.diagnosis.verdicts.find(
    (v: { key: string }) => v.key === "shareRate",
  );
  expect(shareVerdict.band).toBe("ok");
});
