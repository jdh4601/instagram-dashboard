// settings GET 마스킹 테스트. 실제 settings store(임시 디렉터리)를 통해
// 라우트가 원문 키/토큰을 응답에 노출하지 않는지 검증한다.
jest.mock("@/lib/settings", () => {
  const { mkdtempSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
  const { tmpdir } = jest.requireActual<typeof import("node:os")>("node:os");
  const { join } = jest.requireActual<typeof import("node:path")>("node:path");
  const { createSettingsStore } =
    jest.requireActual<typeof import("@/lib/settings/store")>("@/lib/settings/store");
  const store = createSettingsStore(mkdtempSync(join(tmpdir(), "settings-route-")));
  return { getSettingsStore: () => store };
});

import { GET, POST } from "@/app/api/settings/route";
import { getSettingsStore } from "@/lib/settings";

const ANTHROPIC_KEY = "sk-ant-secret-abcdef1234567890";
const OPENAI_KEY = "sk-openai-secret-zyxwvu9876543210";
const IG_TOKEN = "igaas-instagram-token-qwerty1234567890";

function settingsPost(body: string, headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/settings", {
    method: "POST",
    headers: { host: "localhost:3000", ...headers },
    body,
  });
}

test("GET /api/settings는 원문 API 키/토큰을 절대 노출하지 않는다", async () => {
  await getSettingsStore().save({
    providers: {
      anthropic: { apiKey: ANTHROPIC_KEY },
      openai: { apiKey: OPENAI_KEY },
    },
    instagram: { accessToken: IG_TOKEN },
  });

  const res = await GET();
  expect(res.status).toBe(200);
  const raw = await res.text();

  // 원문 값은 응답 본문 어디에도 부분 문자열로라도 나타나면 안 된다.
  expect(raw).not.toContain(ANTHROPIC_KEY);
  expect(raw).not.toContain(OPENAI_KEY);
  expect(raw).not.toContain(IG_TOKEN);

  const body = JSON.parse(raw);
  expect(body.providers.anthropic.configured).toBe(true);
  expect(body.providers.openai.configured).toBe(true);
  expect(body.instagram.configured).toBe(true);
  expect(body.providers.anthropic.maskedKey).not.toBeNull();
  expect(body.instagram.maskedKey).not.toBeNull();
  // 마스킹 값은 원문 전체를 포함하지 않는다 (앞 3자/뒤 4자만 남음).
  expect(body.providers.anthropic.maskedKey).not.toContain("secret");
});

test("GET /api/settings는 키 미설정 시 maskedKey=null, configured=false를 반환한다", async () => {
  const res = await GET();
  const body = await res.json();
  expect(body.providers.kimi.configured).toBe(false);
  expect(body.providers.kimi.maskedKey).toBeNull();
});

test("POST /api/settings는 text/plain 본문을 415로 거부한다", async () => {
  const res = await POST(
    settingsPost('{"textProvider":"openai"}', { "content-type": "text/plain" }),
  );
  expect(res.status).toBe(415);
});

test("POST /api/settings는 다른 Origin의 JSON 요청을 403으로 거부한다", async () => {
  const res = await POST(
    settingsPost('{"textProvider":"openai"}', {
      "content-type": "application/json",
      origin: "https://evil.example",
    }),
  );
  expect(res.status).toBe(403);
});

test("POST /api/settings는 깨진 JSON을 400으로 반환한다", async () => {
  const res = await POST(
    settingsPost("{not-json", { "content-type": "application/json" }),
  );
  expect(res.status).toBe(400);
});

test("POST /api/settings 성공 응답도 저장된 원문 키를 노출하지 않는다", async () => {
  const secret = "sk-kimi-route-secret-1234567890";
  const res = await POST(
    settingsPost(JSON.stringify({ providers: { kimi: { apiKey: secret } } }), {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    }),
  );
  expect(res.status).toBe(200);
  expect(await res.text()).not.toContain(secret);
});
