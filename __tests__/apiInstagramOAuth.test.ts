const { saveInstagramCredential, clearInstagramCredential } = vi.hoisted(() => ({
  saveInstagramCredential: vi.fn(),
  clearInstagramCredential: vi.fn(),
}));
vi.mock("@/lib/settings", () => ({
  getSettingsStore: () => ({ saveInstagramCredential, clearInstagramCredential }),
}));

import { NextRequest } from "next/server";
import { GET as startOAuth } from "@/app/api/auth/instagram/start/route";
import { GET as finishOAuth } from "@/app/api/auth/instagram/callback/route";
import { POST as disconnectOAuth } from "@/app/api/auth/instagram/disconnect/route";
import { INSTAGRAM_OAUTH_STATE_COOKIE } from "@/lib/instagram/oauth";

const originalEnv = {
  appId: process.env.INSTAGRAM_APP_ID,
  appSecret: process.env.INSTAGRAM_APP_SECRET,
  redirectUri: process.env.INSTAGRAM_OAUTH_REDIRECT_URI,
};

function configureOAuth() {
  process.env.INSTAGRAM_APP_ID = "123";
  process.env.INSTAGRAM_APP_SECRET = "secret";
  process.env.INSTAGRAM_OAUTH_REDIRECT_URI =
    "http://localhost:3000/api/auth/instagram/callback";
}

afterEach(() => {
  vi.restoreAllMocks();
  saveInstagramCredential.mockReset();
  clearInstagramCredential.mockReset();
  if (originalEnv.appId === undefined) delete process.env.INSTAGRAM_APP_ID;
  else process.env.INSTAGRAM_APP_ID = originalEnv.appId;
  if (originalEnv.appSecret === undefined) delete process.env.INSTAGRAM_APP_SECRET;
  else process.env.INSTAGRAM_APP_SECRET = originalEnv.appSecret;
  if (originalEnv.redirectUri === undefined) delete process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  else process.env.INSTAGRAM_OAUTH_REDIRECT_URI = originalEnv.redirectUri;
});

test("start route는 설정 누락 시 닫히고, 설정되면 state cookie와 Meta redirect를 만든다", async () => {
  delete process.env.INSTAGRAM_APP_ID;
  delete process.env.INSTAGRAM_APP_SECRET;
  delete process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  expect((await startOAuth()).status).toBe(503);

  configureOAuth();
  const response = await startOAuth();
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toContain("instagram.com/oauth/authorize");
  const cookie = response.cookies.get(INSTAGRAM_OAUTH_STATE_COOKIE);
  expect(cookie?.value).toHaveLength(43);
  expect(response.headers.get("location")).toContain(`state=${cookie?.value}`);
});

test("callback route는 state 불일치를 거부한다", async () => {
  configureOAuth();
  const request = new NextRequest(
    "http://localhost:3000/api/auth/instagram/callback?code=abc&state=wrong",
    { headers: { cookie: `${INSTAGRAM_OAUTH_STATE_COOKIE}=expected` } },
  );
  expect((await finishOAuth(request)).status).toBe(400);
  expect(saveInstagramCredential).not.toHaveBeenCalled();
});

test("callback route는 장기 토큰만 settings에 저장한다", async () => {
  configureOAuth();
  vi
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "short" }), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "long", expires_in: 5_184_000 }), { status: 200 }),
    );
  const request = new NextRequest(
    "http://localhost:3000/api/auth/instagram/callback?code=abc&state=expected",
    { headers: { cookie: `${INSTAGRAM_OAUTH_STATE_COOKIE}=expected` } },
  );
  const response = await finishOAuth(request);
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("http://localhost:3000/settings?instagram=connected");
  expect(saveInstagramCredential).toHaveBeenCalledWith({
    accessToken: "long",
    expiresAt: expect.any(String),
  });
});

test("disconnect route는 same-origin JSON 요청에서만 토큰을 지운다", async () => {
  const blocked = await disconnectOAuth(
    new Request("http://localhost:3000/api/auth/instagram/disconnect", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: "{}",
    }),
  );
  expect(blocked.status).toBe(403);
  expect(clearInstagramCredential).not.toHaveBeenCalled();

  const allowed = await disconnectOAuth(
    new Request("http://localhost:3000/api/auth/instagram/disconnect", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: "{}",
    }),
  );
  expect(allowed.status).toBe(200);
  expect(clearInstagramCredential).toHaveBeenCalledTimes(1);
});
