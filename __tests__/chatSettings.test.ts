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
