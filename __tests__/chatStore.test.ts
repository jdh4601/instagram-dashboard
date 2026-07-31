import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createChatStore,
  MAX_CONVERSATIONS,
  MAX_STORED_MESSAGES,
} from "@/lib/chat/store";

function newDir() {
  return mkdtempSync(join(tmpdir(), "chat-store-"));
}

function newStore() {
  return createChatStore(newDir());
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

test(`한 대화에는 최근 ${MAX_STORED_MESSAGES}개만 남기고 오래된 메시지를 버린다`, async () => {
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
  const dir = newDir();
  const store = createChatStore(dir);
  await store.append([message("권한 확인")]);

  const { statSync } = await import("node:fs");
  expect(statSync(join(dir, "chat.json")).mode & 0o777).toBe(0o600);
  // 대화 내용이 평문으로 남는 파일이므로 실제로 기록됐는지도 확인한다.
  expect(readFileSync(join(dir, "chat.json"), "utf8")).toContain("권한 확인");
});

describe("구 형식 이관", () => {
  test("단일 세션 파일을 대화 하나로 읽어들인다", async () => {
    const dir = newDir();
    writeFileSync(
      join(dir, "chat.json"),
      JSON.stringify({
        messages: [message("예전에 하던 질문"), message("예전 답", "assistant")],
        updatedAt: "2026-07-30T00:00:00.000Z",
      }),
    );
    const store = createChatStore(dir);

    expect((await store.get()).map((m) => m.content)).toEqual(["예전에 하던 질문", "예전 답"]);
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("예전에 하던 질문");
  });

  test("이관한 대화의 id는 읽을 때마다 바뀌지 않는다", async () => {
    // 이관은 파일에 곧바로 쓰지 않으므로 id를 매번 새로 만들면 목록의 id와
    // 활성 id가 어긋나고, 목록에서 고른 대화를 열 수 없게 된다.
    const dir = newDir();
    writeFileSync(join(dir, "chat.json"), JSON.stringify({ messages: [message("예전 질문")] }));
    const store = createChatStore(dir);

    const listed = (await store.list())[0].id;
    expect(await store.activeId()).toBe(listed);
    expect((await store.list())[0].id).toBe(listed);
    expect((await store.open(listed))?.messages).toHaveLength(1);
  });

  test("이관한 대화 위에 새 대화를 열어도 예전 대화가 남는다", async () => {
    const dir = newDir();
    writeFileSync(join(dir, "chat.json"), JSON.stringify({ messages: [message("예전 질문")] }));
    const store = createChatStore(dir);

    await store.create();
    await store.append([message("새 질문")]);

    expect((await store.get()).map((m) => m.content)).toEqual(["새 질문"]);
    expect(await store.list()).toHaveLength(2);
  });
});

describe("대화 목록", () => {
  test("제목은 첫 질문에서 딴다", async () => {
    const store = newStore();
    await store.append([message("최근 2주 성과를 진단해줘")]);

    expect((await store.list())[0].title).toBe("최근 2주 성과를 진단해줘");
  });

  test("아직 아무것도 묻지 않은 대화도 목록에 나온다", async () => {
    const store = newStore();
    await store.create();

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].messageCount).toBe(0);
  });

  test("최근에 쓴 대화가 위로 온다", async () => {
    const store = newStore();
    await store.append([message("첫 번째")]);
    const first = await store.activeId();
    await store.create();
    await store.append([message("두 번째")]);

    const list = await store.list();
    expect(list.map((c) => c.title)).toEqual(["두 번째", "첫 번째"]);
    expect(list[1].id).toBe(first);
  });

  test("새 대화를 열면 이전 대화 메시지가 섞이지 않는다", async () => {
    const store = newStore();
    await store.append([message("이전 대화")]);
    await store.create();

    expect(await store.get()).toEqual([]);
  });

  test("활성 대화가 비어 있으면 새 대화를 또 만들지 않는다", async () => {
    const store = newStore();
    const first = await store.create();
    const second = await store.create();

    expect(second).toBe(first);
    expect(await store.list()).toHaveLength(1);
  });

  test(`대화는 최근 ${MAX_CONVERSATIONS}개까지만 보관한다`, async () => {
    const store = newStore();
    for (let i = 0; i < MAX_CONVERSATIONS + 3; i += 1) {
      await store.create();
      await store.append([message(`대화 ${i}`)]);
    }

    const list = await store.list();
    expect(list).toHaveLength(MAX_CONVERSATIONS);
    expect(list.map((c) => c.title)).not.toContain("대화 0");
    expect(list[0].title).toBe(`대화 ${MAX_CONVERSATIONS + 2}`);
  });
});

describe("대화 열기와 삭제", () => {
  test("이전 대화를 열면 그 대화가 활성이 된다", async () => {
    const store = newStore();
    await store.append([message("예전 질문")]);
    const older = (await store.activeId())!;
    await store.create();
    await store.append([message("지금 질문")]);

    const opened = await store.open(older);
    expect(opened?.messages.map((m) => m.content)).toEqual(["예전 질문"]);
    expect(await store.activeId()).toBe(older);
    expect((await store.get()).map((m) => m.content)).toEqual(["예전 질문"]);
  });

  test("없는 대화를 열면 null이고 활성 대화는 그대로다", async () => {
    const store = newStore();
    await store.append([message("그대로")]);
    const active = await store.activeId();

    expect(await store.open("없는-id")).toBeNull();
    expect(await store.activeId()).toBe(active);
  });

  test("대화를 지우면 목록에서 사라진다", async () => {
    const store = newStore();
    await store.append([message("지울 대화")]);
    const target = (await store.activeId())!;
    await store.create();
    await store.append([message("남길 대화")]);

    await store.remove(target);
    expect((await store.list()).map((c) => c.title)).toEqual(["남길 대화"]);
  });

  test("활성 대화를 지우면 가장 최근 대화가 활성이 된다", async () => {
    const store = newStore();
    await store.append([message("남길 대화")]);
    const survivor = await store.activeId();
    await store.create();
    await store.append([message("지울 대화")]);
    const target = (await store.activeId())!;

    await store.remove(target);
    expect(await store.activeId()).toBe(survivor);
    expect((await store.get()).map((m) => m.content)).toEqual(["남길 대화"]);
  });

  test("마지막 대화를 지우면 빈 상태로 돌아간다", async () => {
    const store = newStore();
    await store.append([message("하나뿐인 대화")]);
    await store.remove((await store.activeId())!);

    expect(await store.list()).toEqual([]);
    expect(await store.get()).toEqual([]);
  });
});
