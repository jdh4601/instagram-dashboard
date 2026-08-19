import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "chat-provider-route-"));

let localRuntime = true;
let detected = { "claude-cli": true, "codex-cli": true, "gemini-cli": true };

vi.mock("@/lib/runtime/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/runtime/config")>(
    "@/lib/runtime/config",
  );
  return {
    ...actual,
    resolveRuntimeConfig: () => ({
      ...actual.resolveRuntimeConfig(),
      dataDir,
      isLocalRuntime: localRuntime,
    }),
  };
});

vi.mock("@/lib/llm/chat/cliDetect", () => ({
  detectAvailableClis: async () => detected,
}));

const { POST } = await import("@/app/api/chat/provider/route");
const { getSettingsStore } = await import("@/lib/settings");

function post(body: unknown): Request {
  return new Request("http://localhost:3000/api/chat/provider", {
    method: "POST",
    headers: { host: "localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  localRuntime = true;
  detected = { "claude-cli": true, "codex-cli": true, "gemini-cli": true };
  const { rmSync } = await import("node:fs");
  rmSync(join(dataDir, "settings.json"), { force: true });
});

test("CLI 제공자와 모델을 함께 저장한다", async () => {
  const res = await POST(post({ provider: "codex-cli", model: "gpt-5.5" }));

  expect(res.status).toBe(200);
  const settings = await getSettingsStore().get();
  expect(settings.chatProvider).toBe("codex-cli");
  expect(settings.cliProviders["codex-cli"].model).toBe("gpt-5.5");
});

test("모델을 비우면 CLI 기본값으로 되돌린다", async () => {
  await POST(post({ provider: "claude-cli", model: "opus" }));
  await POST(post({ provider: "claude-cli", model: "" }));

  expect((await getSettingsStore().get()).cliProviders["claude-cli"].model).toBe("");
});

test("프리셋에 없는 모델은 거절한다", async () => {
  const res = await POST(post({ provider: "claude-cli", model: "--dangerously-skip-permissions" }));

  expect(res.status).toBe(400);
  // 거절한 요청이 제공자만 슬쩍 바꿔 놓으면 안 된다.
  expect((await getSettingsStore().get()).chatProviderExplicit).toBeUndefined();
});

test("설치되지 않은 CLI는 이유와 함께 거절한다", async () => {
  detected = { ...detected, "codex-cli": false };

  const res = await POST(post({ provider: "codex-cli" }));

  expect(res.status).toBe(400);
  expect(String((await res.json()).error)).toContain("codex");
});

test("API 제공자의 모델은 자막 분석과 같은 칸에 저장된다", async () => {
  await getSettingsStore().save({ providers: { anthropic: { apiKey: "sk-test" } } });

  const res = await POST(post({ provider: "anthropic", model: "claude-sonnet-4-6" }));

  expect(res.status).toBe(200);
  const settings = await getSettingsStore().get();
  expect(settings.chatProvider).toBe("anthropic");
  expect(settings.providers.anthropic.model).toBe("claude-sonnet-4-6");
});

test("배포 환경에서는 이 경로가 없다", async () => {
  localRuntime = false;

  expect((await POST(post({ provider: "claude-cli" }))).status).toBe(404);
});
