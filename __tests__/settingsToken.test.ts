import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSettingsStore } from "@/lib/settings/store";

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "settings-token-"));
  return { dir, store: createSettingsStore(dir) };
}

test("새 Instagram 토큰 저장 시 발급일(ISO)이 기록된다", async () => {
  const { store } = tmp();
  await store.save({ instagram: { accessToken: "IGtoken-new-0001" } });
  const s = await store.get();
  expect(s.instagram?.accessToken).toBe("IGtoken-new-0001");
  expect(s.instagramTokenIssuedAt).toBeDefined();
  expect(Number.isNaN(Date.parse(s.instagramTokenIssuedAt!))).toBe(false);
});

test("동일 토큰 재저장·빈 값 저장은 발급일을 유지한다", async () => {
  const { store } = tmp();
  await store.save({ instagram: { accessToken: "IGtoken-keep-1234" } });
  const issuedAt = (await store.get()).instagramTokenIssuedAt;
  await store.save({ instagram: { accessToken: "IGtoken-keep-1234" } });
  await store.save({ instagram: { accessToken: "" } });
  const s = await store.get();
  expect(s.instagram?.accessToken).toBe("IGtoken-keep-1234");
  expect(s.instagramTokenIssuedAt).toBe(issuedAt);
});

test("provider만 저장할 때도 토큰 발급일이 유지된다", async () => {
  const { store } = tmp();
  await store.save({ instagram: { accessToken: "IGtoken-keep-1234" } });
  const issuedAt = (await store.get()).instagramTokenIssuedAt;
  await store.save({ providers: { openai: { apiKey: "sk-openai-keep-1234" } } });
  expect((await store.get()).instagramTokenIssuedAt).toBe(issuedAt);
});

test("토큰을 교체하면 발급일이 갱신된다", async () => {
  const { store } = tmp();
  await store.save({ instagram: { accessToken: "IGtoken-old-1111" } });
  const before = Date.parse((await store.get()).instagramTokenIssuedAt!);
  await store.save({ instagram: { accessToken: "IGtoken-new-2222" } });
  const s = await store.get();
  expect(s.instagram?.accessToken).toBe("IGtoken-new-2222");
  expect(Date.parse(s.instagramTokenIssuedAt!)).toBeGreaterThanOrEqual(before);
});

test("masked()는 발급일을 노출하되 토큰은 새지 않는다", async () => {
  const { store } = tmp();
  expect((await store.masked()).instagramTokenIssuedAt).toBeNull();
  await store.save({ instagram: { accessToken: "IGtoken-secret-7777" } });
  const m = await store.masked();
  expect(m.instagramTokenIssuedAt).toBe((await store.get()).instagramTokenIssuedAt);
  expect(JSON.stringify(m)).not.toContain("secret-7777");
});

test("settings.json은 소유자 전용(0o600)으로 저장된다", async () => {
  const { dir, store } = tmp();
  await store.save({ providers: { openai: { apiKey: "sk-openai-keep-1234" } } });
  const mode = statSync(join(dir, "settings.json")).mode & 0o777;
  expect(mode).toBe(0o600);
});
