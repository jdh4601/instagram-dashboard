import {
  buildInstagramAuthorizationUrl,
  exchangeInstagramAuthorizationCode,
  getInstagramOAuthStatus,
  resolveInstagramOAuthConfig,
} from "@/lib/instagram/oauth";

const config = {
  appId: "12345",
  appSecret: "top-secret",
  redirectUri: "https://dashboard.example/api/auth/instagram/callback",
};

test("OAuth config는 세 값을 모두 요구하고 localhost 외 HTTP를 거부한다", () => {
  expect(resolveInstagramOAuthConfig({})).toBeNull();
  expect(() => resolveInstagramOAuthConfig({ INSTAGRAM_APP_ID: "123" })).toThrow();
  expect(() =>
    resolveInstagramOAuthConfig({
      INSTAGRAM_APP_ID: "123",
      INSTAGRAM_APP_SECRET: "secret",
      INSTAGRAM_OAUTH_REDIRECT_URI: "http://dashboard.example/callback",
    }),
  ).toThrow("HTTPS");
  expect(
    resolveInstagramOAuthConfig({
      INSTAGRAM_APP_ID: "123",
      INSTAGRAM_APP_SECRET: "secret",
      INSTAGRAM_OAUTH_REDIRECT_URI: "http://localhost:3000/api/auth/instagram/callback",
    }),
  ).toMatchObject({ appId: "123" });
});

test("OAuth status는 부분 설정을 비밀 노출 없이 오류로 표시한다", () => {
  expect(getInstagramOAuthStatus({ INSTAGRAM_APP_SECRET: "secret" })).toEqual({
    configured: false,
    redirectUri: null,
    configurationError: true,
  });
});

test("authorization URL은 최신 Instagram Business scope와 CSRF state를 포함한다", () => {
  const url = buildInstagramAuthorizationUrl(config, "random-state");
  expect(url.origin).toBe("https://www.instagram.com");
  expect(url.searchParams.get("client_id")).toBe("12345");
  expect(url.searchParams.get("state")).toBe("random-state");
  expect(url.searchParams.get("scope")).toContain("instagram_business_basic");
  expect(url.searchParams.get("scope")).toContain("instagram_business_manage_insights");
  expect(url.toString()).not.toContain(config.appSecret);
});

test("authorization code를 단기 토큰 뒤 장기 토큰으로 교환한다", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "short-token", user_id: 1 }), { status: 200 }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "long-token", expires_in: 5_184_000 }), {
        status: 200,
      }),
    );

  await expect(exchangeInstagramAuthorizationCode("auth-code", config, fetcher)).resolves.toEqual({
    accessToken: "long-token",
    expiresIn: 5_184_000,
  });
  const firstBody = fetcher.mock.calls[0][1].body as URLSearchParams;
  expect(firstBody.get("client_secret")).toBe(config.appSecret);
  expect(firstBody.get("code")).toBe("auth-code");
  expect(String(fetcher.mock.calls[1][0])).toContain("ig_exchange_token");
});
