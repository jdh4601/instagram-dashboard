const mockList = vi.hoisted(() => vi.fn(async () => []));

vi.mock("@/lib/store", () => ({
  getApplicationRepository: vi.fn(() => ({ list: mockList })),
}));
// 신청 폼은 선택 연동이다. 기본은 미연동으로 두고 필요한 테스트에서만 켠다.
vi.mock("@/lib/walla", () => ({
  getWallaConnection: vi.fn(async () => null),
}));

import type { MockedFunction } from "vitest";
import { GET } from "@/app/api/applications/route";
import { getWallaConnection } from "@/lib/walla";

const mockConnection = getWallaConnection as MockedFunction<typeof getWallaConnection>;

beforeEach(() => {
  mockList.mockResolvedValue([]);
  mockConnection.mockResolvedValue(null);
});

test("미연동이면 connected가 거짓이다", async () => {
  // 저장소는 미연동일 때도 빈 배열을 준다. 배열만 보면 화면이 "신청 0건"과 구분하지 못한다.
  const body = await (await GET()).json();

  expect(body.connected).toBe(false);
  expect(body.applications).toEqual([]);
});

test("연동돼 있으면 신청이 0건이어도 connected가 참이다", async () => {
  mockConnection.mockResolvedValue({ client: {} as never, formId: "form-1" });

  const body = await (await GET()).json();

  expect(body.connected).toBe(true);
  expect(body.applications).toEqual([]);
});
