import { refreshInstagramTokenIfDue, type TokenRefreshStore } from "@/lib/instagram/tokenRefresh";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-28T00:00:00.000Z");

interface StoredCredential {
  accessToken: string;
  expiresAt?: string;
}

function fakeStore(settings: {
  accessToken?: string;
  issuedAt?: string;
  expiresAt?: string;
}): { store: TokenRefreshStore; saved: StoredCredential[] } {
  const saved: StoredCredential[] = [];
  return {
    saved,
    store: {
      get: async () => ({
        instagram: settings.accessToken ? { accessToken: settings.accessToken } : undefined,
        instagramTokenIssuedAt: settings.issuedAt,
        instagramTokenExpiresAt: settings.expiresAt,
      }),
      saveInstagramCredential: async (credential) => {
        saved.push(credential);
      },
    },
  };
}

function okResponse(expiresIn: number | null = 5_184_000): Response {
  const body: Record<string, unknown> = { access_token: "renewed-token" };
  if (expiresIn !== null) body.expires_in = expiresIn;
  return new Response(JSON.stringify(body), { status: 200 });
}

function inDays(days: number): string {
  return new Date(NOW.getTime() + days * DAY_MS).toISOString();
}

test("토큰이 없으면 네트워크를 부르지 않는다", async () => {
  const { store, saved } = fakeStore({});
  const fetcher = vi.fn();

  await expect(refreshInstagramTokenIfDue({ store, now: NOW, fetcher, env: {} })).resolves.toEqual({
    status: "skipped",
    reason: "no-token",
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(saved).toEqual([]);
});

test("환경변수 토큰이 우선인 설치본에서는 저장된 토큰을 건드리지 않는다", async () => {
  const { store, saved } = fakeStore({ accessToken: "stored", expiresAt: inDays(1) });
  const fetcher = vi.fn();

  await expect(
    refreshInstagramTokenIfDue({
      store,
      now: NOW,
      fetcher,
      env: { INSTAGRAM_ACCESS_TOKEN: "from-env" },
    }),
  ).resolves.toEqual({ status: "skipped", reason: "env-managed" });
  expect(fetcher).not.toHaveBeenCalled();
  expect(saved).toEqual([]);
});

test("만료가 넉넉히 남았으면 갱신하지 않는다", async () => {
  const { store, saved } = fakeStore({ accessToken: "stored", expiresAt: inDays(40) });
  const fetcher = vi.fn();

  await expect(refreshInstagramTokenIfDue({ store, now: NOW, fetcher, env: {} })).resolves.toEqual({
    status: "skipped",
    reason: "not-due",
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(saved).toEqual([]);
});

test("만료가 임박하면 갱신하고 새 만료 시각과 함께 저장한다", async () => {
  const { store, saved } = fakeStore({ accessToken: "stored", expiresAt: inDays(10) });
  const fetcher = vi.fn().mockResolvedValue(okResponse());

  const expectedExpiry = new Date(NOW.getTime() + 5_184_000 * 1_000).toISOString();
  await expect(refreshInstagramTokenIfDue({ store, now: NOW, fetcher, env: {} })).resolves.toEqual({
    status: "refreshed",
    expiresAt: expectedExpiry,
  });
  expect(saved).toEqual([{ accessToken: "renewed-token", expiresAt: expectedExpiry }]);
});

// 만료된 토큰은 갱신 엔드포인트도 거부한다. 헛된 호출 대신 재연결을 안내한다.
test("이미 만료된 토큰은 호출 없이 재연결을 안내한다", async () => {
  const { store, saved } = fakeStore({ accessToken: "stored", expiresAt: inDays(-1) });
  const fetcher = vi.fn();

  const outcome = await refreshInstagramTokenIfDue({ store, now: NOW, fetcher, env: {} });
  expect(outcome.status).toBe("failed");
  expect(outcome).toHaveProperty("error", expect.stringContaining("/settings"));
  expect(fetcher).not.toHaveBeenCalled();
  expect(saved).toEqual([]);
});

// 설정 화면에 직접 붙여넣은 토큰에는 만료 시각이 없다. 한 번 갱신해 두면
// 그 다음부터는 만료 시각을 알고 판단할 수 있다.
test("만료 시각을 모르면 갱신해서 만료 시각을 기록한다", async () => {
  const { store, saved } = fakeStore({ accessToken: "stored" });
  const fetcher = vi.fn().mockResolvedValue(okResponse());

  const outcome = await refreshInstagramTokenIfDue({ store, now: NOW, fetcher, env: {} });
  expect(outcome.status).toBe("refreshed");
  expect(saved[0].expiresAt).toBe(new Date(NOW.getTime() + 5_184_000 * 1_000).toISOString());
});

// Meta는 발급 24시간이 지나지 않은 토큰의 갱신을 거부한다.
test("만료 시각을 몰라도 발급 24시간 이내면 갱신하지 않는다", async () => {
  const { store, saved } = fakeStore({ accessToken: "stored", issuedAt: inDays(-0.5) });
  const fetcher = vi.fn();

  await expect(refreshInstagramTokenIfDue({ store, now: NOW, fetcher, env: {} })).resolves.toEqual({
    status: "skipped",
    reason: "too-fresh",
  });
  expect(fetcher).not.toHaveBeenCalled();
});

// 갱신은 곁다리 작업이다. 실패가 동기화나 일일 리포트를 죽이면 안 된다.
test("갱신 호출이 실패해도 예외를 던지지 않고 사유를 돌려준다", async () => {
  const { store, saved } = fakeStore({ accessToken: "stored", expiresAt: inDays(3) });
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));

  const outcome = await refreshInstagramTokenIfDue({ store, now: NOW, fetcher, env: {} });
  expect(outcome.status).toBe("failed");
  expect(saved).toEqual([]);
});

// 갱신 응답에 expires_in이 없으면 만료 시각을 지어내지 않는다.
test("만료 시각이 응답에 없으면 기록하지 않는다", async () => {
  const { store, saved } = fakeStore({ accessToken: "stored", expiresAt: inDays(3) });
  const fetcher = vi.fn().mockResolvedValue(okResponse(null));

  await expect(refreshInstagramTokenIfDue({ store, now: NOW, fetcher, env: {} })).resolves.toEqual({
    status: "refreshed",
    expiresAt: null,
  });
  expect(saved).toEqual([{ accessToken: "renewed-token", expiresAt: undefined }]);
});
