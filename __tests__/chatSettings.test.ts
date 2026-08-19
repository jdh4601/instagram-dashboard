import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSettingsStore } from "@/lib/settings/store";

function newStore() {
  return createSettingsStore(mkdtempSync(join(tmpdir(), "chat-settings-")));
}

test("챗봇 제공자를 지정하지 않으면 텍스트 제공자를 따라간다", async () => {
  const store = newStore();
  await store.save({ textProvider: "openai" });

  expect((await store.get()).chatProvider).toBe("openai");
});

test("챗봇 제공자로 로컬 CLI를 저장할 수 있다", async () => {
  const store = newStore();
  await store.save({ chatProvider: "codex-cli" });

  expect((await store.get()).chatProvider).toBe("codex-cli");
  expect((await store.masked()).chatProvider).toBe("codex-cli");
});

test("챗봇 제공자를 바꿔도 텍스트 제공자는 그대로다", async () => {
  const store = newStore();
  await store.save({ textProvider: "anthropic", chatProvider: "claude-cli" });

  const settings = await store.get();
  expect(settings.textProvider).toBe("anthropic");
  expect(settings.chatProvider).toBe("claude-cli");
});

test("chatProvider가 없던 기존 설정 파일도 그대로 읽힌다", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chat-settings-legacy-"));
  // 이 기능 이전에 저장된 파일 형태.
  writeFileSync(
    join(dir, "settings.json"),
    JSON.stringify({
      textProvider: "kimi",
      providers: { anthropic: {}, openai: {}, kimi: {}, gemini: {} },
    }),
  );

  const settings = await createSettingsStore(dir).get();
  expect(settings.chatProvider).toBe("kimi");
});

test("CLI별 모델을 저장하고 다시 읽을 수 있다", async () => {
  const store = newStore();
  await store.save({ chatProvider: "codex-cli", cliProviders: { "codex-cli": { model: "gpt-5.5" } } });

  const settings = await store.get();
  expect(settings.cliProviders["codex-cli"].model).toBe("gpt-5.5");
  // 건드리지 않은 CLI는 기본값(빈 값 = CLI 자신의 기본 모델)으로 남는다.
  expect(settings.cliProviders["claude-cli"].model).toBeUndefined();
  expect((await store.masked()).cliProviders["codex-cli"].model).toBe("gpt-5.5");
});

test("한 CLI의 모델을 바꿔도 다른 CLI의 선택은 남는다", async () => {
  const store = newStore();
  await store.save({ cliProviders: { "claude-cli": { model: "opus" } } });
  await store.save({ cliProviders: { "codex-cli": { model: "gpt-5.5" } } });

  const settings = await store.get();
  expect(settings.cliProviders["claude-cli"].model).toBe("opus");
  expect(settings.cliProviders["codex-cli"].model).toBe("gpt-5.5");
});

test("모델을 빈 값으로 저장하면 CLI 기본값으로 되돌아간다", async () => {
  const store = newStore();
  await store.save({ cliProviders: { "claude-cli": { model: "opus" } } });
  await store.save({ cliProviders: { "claude-cli": { model: "" } } });

  expect((await store.get()).cliProviders["claude-cli"].model).toBe("");
});

test("cliProviders가 없던 기존 설정 파일도 그대로 읽힌다", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chat-settings-nocli-"));
  writeFileSync(
    join(dir, "settings.json"),
    JSON.stringify({
      textProvider: "anthropic",
      chatProvider: "claude-cli",
      providers: { anthropic: {}, openai: {}, kimi: {}, gemini: {} },
    }),
  );

  const settings = await createSettingsStore(dir).get();
  expect(settings.cliProviders["claude-cli"].model).toBeUndefined();
});
