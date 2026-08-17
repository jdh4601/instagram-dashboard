// reels/[id] 상세 라우트 테스트. 저장소는 mock으로 대체한다.
vi.mock("@/lib/store", () => ({
  getRepository: vi.fn(),
  getReelHistoryRepository: vi.fn(),
  getAdSpendRepository: vi.fn(),
}));

// 광고 성과는 Marketing API에서 온다. 상세 테스트는 연동 없음을 기본값으로 둔다.
vi.mock("@/lib/ads/cache", () => ({
  fetchAdPerformance: vi.fn(),
}));

import { GET } from "@/app/api/reels/[id]/route";
import { getRepository, getReelHistoryRepository, getAdSpendRepository } from "@/lib/store";
import { fetchAdPerformance } from "@/lib/ads/cache";
import type { AdPerformance } from "@/lib/ads/map";
import type { AdSpend, Reel } from "@/lib/schemas";

const mockGetRepository = getRepository as unknown as Mock;
const mockGetHistoryRepository = getReelHistoryRepository as unknown as Mock;
const mockGetAdSpendRepository = getAdSpendRepository as unknown as Mock;
const mockFetchAdPerformance = fetchAdPerformance as unknown as Mock;

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
  list: vi.fn(async () => reels),
  get: vi.fn(async (id: string) => reels.find((r) => r.id === id) ?? null),
};
const fakeHistoryRepo = { list: vi.fn(async () => []) };

function adSpendRepo(entries: AdSpend[]) {
  return { list: vi.fn(async () => entries) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRepository.mockReturnValue(fakeRepo);
  mockGetHistoryRepository.mockReturnValue(fakeHistoryRepo);
  mockGetAdSpendRepository.mockReturnValue(adSpendRepo([]));
  mockFetchAdPerformance.mockResolvedValue({ performance: [], configured: false, error: null });
});

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

async function detail(id: string) {
  const res = await GET(new Request(`http://localhost:3000/api/reels/${id}`), ctx(id));
  return { status: res.status, body: await res.json() };
}

test("상세 응답에 이전·다음 이동 정보를 싣지 않는다", async () => {
  // 상세에서 옆 게시물로 건너뛰는 동선을 걷어냈다. 아무도 읽지 않는 필드를 계속
  // 계산하면 목록 전체를 훑는 비용만 남는다.
  const { body } = await detail("캐러셀-2");
  expect(body.nav).toBeUndefined();
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

// --- 광고 도달 ------------------------------------------------------------

const boost = (mediaId: string, overrides: Partial<AdSpend> = {}): AdSpend => ({
  mediaId,
  boostedAt: "2026-06-10",
  spend: 20000,
  views: 2500,
  reach: 2000,
  resultCount: 100,
  resultType: "LINK_CLICK",
  source: "AD_CENTER",
  ...overrides,
});

test("광고를 태운 게시물은 상세에 광고 도달과 지출이 실린다", async () => {
  mockGetAdSpendRepository.mockReturnValue(adSpendRepo([boost("릴스-1")]));

  const { body } = await detail("릴스-1");

  expect(body.ad.adReach).toBe(2000);
  expect(body.ad.spend).toBe(20000);
  // 게시물 레벨 reach는 오가닉만 세므로 광고 도달과 겹치지 않는다.
  expect(body.ad.organicReach).toBe(90);
});

test("광고를 태우지 않은 게시물의 ad는 null이다", async () => {
  // 0이 아니라 null이어야 한다 — "광고를 안 태웠다"와 "태웠는데 아무도 못 봤다"가
  // 화면에서 뒤바뀌면 안 된다.
  mockGetAdSpendRepository.mockReturnValue(adSpendRepo([boost("릴스-2")]));

  const { body } = await detail("릴스-1");

  expect(body.ad).toBeNull();
});

test("다른 게시물의 광고 기록이 섞여 들어가지 않는다", async () => {
  mockGetAdSpendRepository.mockReturnValue(
    adSpendRepo([boost("릴스-1", { reach: 500, spend: 1000 }), boost("릴스-2"), boost("캐러셀-1")]),
  );

  const { body } = await detail("릴스-1");

  expect(body.ad.adReach).toBe(500);
  expect(body.ad.spend).toBe(1000);
});

test("한 게시물을 여러 번 태우면 지출과 도달이 합쳐진다", async () => {
  mockGetAdSpendRepository.mockReturnValue(
    adSpendRepo([
      boost("릴스-1", { boostedAt: "2026-06-10", spend: 1000, reach: 300 }),
      boost("릴스-1", { boostedAt: "2026-06-20", spend: 2000, reach: 700 }),
    ]),
  );

  const { body } = await detail("릴스-1");

  expect(body.ad.spend).toBe(3000);
  expect(body.ad.adReach).toBe(1000);
  expect(body.ad.adCount).toBe(2);
});

test("광고 저장소가 비어 있어도 상세는 정상으로 뜬다", async () => {
  const { status, body } = await detail("릴스-1");
  expect(status).toBe(200);
  expect(body.ad).toBeNull();
});

// --- Marketing API에서 온 광고 --------------------------------------------

const apiPerf = (mediaId: string, overrides: Partial<AdPerformance> = {}): AdPerformance => ({
  mediaId,
  adCount: 1,
  spend: 5000,
  reach: 800,
  impressions: 1200,
  clicks: 40,
  ...overrides,
});

test("Marketing API가 준 광고 성과가 상세에 실린다 — 수동 기록이 없어도 뜬다", async () => {
  mockFetchAdPerformance.mockResolvedValue({
    performance: [apiPerf("릴스-1")],
    configured: true,
    error: null,
  });

  const { body } = await detail("릴스-1");

  expect(body.ad.adReach).toBe(800);
  expect(body.ad.spend).toBe(5000);
  expect(body.ad.organicReach).toBe(90);
});

test("다른 게시물의 API 광고는 섞이지 않는다", async () => {
  mockFetchAdPerformance.mockResolvedValue({
    performance: [apiPerf("릴스-2"), apiPerf("캐러셀-1")],
    configured: true,
    error: null,
  });

  const { body } = await detail("릴스-1");

  expect(body.ad).toBeNull();
});

test("API와 수동 기록이 겹치면 지출이 큰 쪽 한 줄만 보여 준다", async () => {
  mockFetchAdPerformance.mockResolvedValue({
    performance: [apiPerf("릴스-1", { spend: 1000, reach: 100 })],
    configured: true,
    error: null,
  });
  mockGetAdSpendRepository.mockReturnValue(
    adSpendRepo([boost("릴스-1", { spend: 9000, reach: 900 })]),
  );

  const { body } = await detail("릴스-1");

  expect(body.ad.spend).toBe(9000);
});

test("Marketing API가 실패해도 상세는 200으로 뜬다", async () => {
  // 광고는 곁다리다. 외부 API 장애로 게시물 상세가 통째로 막히면 안 된다.
  mockFetchAdPerformance.mockResolvedValue({
    performance: [],
    configured: true,
    error: "Marketing API에 연결하지 못했습니다",
  });

  const { status, body } = await detail("릴스-1");

  expect(status).toBe(200);
  expect(body.ad).toBeNull();
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
    list: vi.fn(async () => mixed),
    get: vi.fn(async (id: string) => mixed.find((r) => r.id === id) ?? null),
  });

  const { body } = await detail("캐러셀-대상");

  expect(body.analysis.baselineActive).toBe(true);
  const shareVerdict = body.analysis.diagnosis.verdicts.find(
    (v: { key: string }) => v.key === "shareRate",
  );
  expect(shareVerdict.band).toBe("ok");
});
import type { Mock } from "vitest";
