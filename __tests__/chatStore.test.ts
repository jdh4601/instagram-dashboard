import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChatStore, MAX_STORED_MESSAGES } from "@/lib/chat/store";

function newStore() {
  return createChatStore(mkdtempSync(join(tmpdir(), "chat-store-")));
}

function message(content: string, role: "user" | "assistant" = "user") {
  return { role, content, createdAt: "2026-07-31T00:00:00.000Z" };
}

test("저장된 대화가 없으면 빈 배열을 돌려준다", async () => {
  expect(await newStore().get()).toEqual([]);
});

test("추가한 메시지를 순서대로 유지한다", async () => {
  const store = newStore();
  await store.append([message("병목이 어디야?")]);
  await store.append([message("도달은 나오는데 팔로우가 약합니다.", "assistant")]);

  const messages = await store.get();
  expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  expect(messages[1].content).toBe("도달은 나오는데 팔로우가 약합니다.");
});

test("초기화하면 대화가 비워진다", async () => {
  const store = newStore();
  await store.append([message("안녕")]);
  await store.clear();
  expect(await store.get()).toEqual([]);
});

test(`디스크에는 최근 ${MAX_STORED_MESSAGES}개만 남기고 오래된 메시지를 버린다`, async () => {
  const store = newStore();
  const overflow = MAX_STORED_MESSAGES + 10;
  await store.append(Array.from({ length: overflow }, (_, i) => message(`메시지 ${i}`)));

  const messages = await store.get();
  expect(messages).toHaveLength(MAX_STORED_MESSAGES);
  // 잘려 나가는 쪽은 항상 오래된 앞부분이어야 한다.
  expect(messages[0].content).toBe(`메시지 ${overflow - MAX_STORED_MESSAGES}`);
  expect(messages.at(-1)!.content).toBe(`메시지 ${overflow - 1}`);
});

test("동시에 들어온 추가 요청이 서로를 덮어쓰지 않는다", async () => {
  const store = newStore();
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => store.append([message(`동시 ${i}`)])),
  );
  expect(await store.get()).toHaveLength(20);
});

test("대화 파일은 소유자만 읽을 수 있는 권한으로 저장된다", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chat-store-mode-"));
  const store = createChatStore(dir);
  await store.append([message("권한 확인")]);

  const { statSync } = await import("node:fs");
  expect(statSync(join(dir, "chat.json")).mode & 0o777).toBe(0o600);
  // 대화 내용이 평문으로 남는 파일이므로 실제로 기록됐는지도 확인한다.
  expect(readFileSync(join(dir, "chat.json"), "utf8")).toContain("권한 확인");
});
