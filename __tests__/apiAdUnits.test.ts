vi.mock("@/lib/store", () => ({ getRepository: vi.fn() }));
vi.mock("@/lib/ads/cache", () => ({ fetchAdUnits: vi.fn() }));

import type { Mock } from "vitest";
import { GET as list } from "@/app/api/ads/units/route";
import { GET as detail } from "@/app/api/ads/units/[adId]/route";
import { getRepository } from "@/lib/store";
import { fetchAdUnits } from "@/lib/ads/cache";
import type { AdUnit } from "@/lib/ads/adUnit";
import type { Reel } from "@/lib/schemas";

const mockGetRepository = getRepository as unknown as Mock;
const mockFetchAdUnits = fetchAdUnits as unknown as Mock;
const repo = { list: vi.fn() };

function unit(over: Partial<AdUnit> = {}): AdUnit {
  return {
    adId: "120253915877380651",
    name: 'Post: "Ep 5."',
    status: "ACTIVE",
    mediaId: "18159331198493386",
    spend: 3427,
    impressions: 698,
    reach: 600,
    clicks: 85,
    goal: "THRUPLAY",
    results: { count: 305, type: "THRUPLAY" },
    costPerResult: 11.23,
    budget: { amount: 4129, kind: "LIFETIME" },
    activity: [{ key: "link_click", label: "링크 클릭", value: 85 }],
    engagements: 48,
    hasDelivery: true,
    ...over,
  };
}

function reel(id: string): Reel {
  return {
    id,
    mediaType: "REELS",
    postedAt: "2026-08-30T00:00:00Z",
    durationSec: 30,
    views: 2519,
    reach: 2000,
    likes: 100,
    comments: 4,
    saves: 30,
    shares: 20,
    avgWatchTimeSec: 10,
    caption: "Ep 4.",
  };
}

function req(path: string): Request {
  return new Request(`http://localhost:3000${path}`);
}

function ctx(adId: string): { params: Promise<{ adId: string }> } {
  return { params: Promise.resolve({ adId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRepository.mockReturnValue(repo);
  repo.list.mockResolvedValue([reel("18159331198493386")]);
  mockFetchAdUnits.mockResolvedValue({ units: [unit()], configured: true, error: null });
});

test("목록은 광고와 되짚은 기간을 돌려준다", async () => {
  const json = await (await list()).json();

  expect(json.configured).toBe(true);
  expect(json.units).toHaveLength(1);
  expect(json.units[0].adId).toBe("120253915877380651");
  expect(json.lookbackDays).toBeGreaterThan(0);
  expect(json.error).toBeNull();
});

// 미설정과 "설정했는데 0건"은 사용자가 할 일이 달라서 화면이 구분해야 한다.
test("연동이 없으면 configured가 false다", async () => {
  mockFetchAdUnits.mockResolvedValue({ units: [], configured: false, error: null });

  const json = await (await list()).json();

  expect(json).toMatchObject({ configured: false, units: [] });
});

test("API가 실패해도 200으로 답하고 실패 문구만 실어 보낸다", async () => {
  mockFetchAdUnits.mockResolvedValue({
    units: [],
    configured: true,
    error: "액세스 토큰이 거부되었습니다",
  });

  const res = await list();
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.error).toBe("액세스 토큰이 거부되었습니다");
});

test("상세는 광고와 이어진 게시물을 함께 돌려준다", async () => {
  const json = await (await detail(req("/api/ads/units/x"), ctx("120253915877380651"))).json();

  expect(json.unit.adId).toBe("120253915877380651");
  expect(json.post).toMatchObject({ id: "18159331198493386", views: 2519 });
});

test("게시물을 못 이어도 광고 상세는 그대로 준다", async () => {
  repo.list.mockResolvedValue([]);

  const json = await (await detail(req("/api/ads/units/x"), ctx("120253915877380651"))).json();

  expect(json.unit.adId).toBe("120253915877380651");
  expect(json.post).toBeNull();
});

test("없는 광고는 404", async () => {
  const res = await detail(req("/api/ads/units/x"), ctx("없는id"));

  expect(res.status).toBe(404);
});

test("광고를 읽지 못했으면 404가 아니라 실패로 알린다", async () => {
  mockFetchAdUnits.mockResolvedValue({ units: [], configured: true, error: "연결 실패" });

  const res = await detail(req("/api/ads/units/x"), ctx("120253915877380651"));
  const json = await res.json();

  expect(res.status).toBe(502);
  expect(json.error).toBe("연결 실패");
});
