import { createGraphClient } from "@/lib/graph/client";

// 페이지네이션 테스트용: 호출된 URL을 기록하고 after 커서별로 다른 페이지를 돌려준다.
function pagedFetch(pages: Record<string, unknown>, calls: string[]) {
  return async (url: string) => {
    calls.push(url);
    const after = new URL(url).searchParams.get("after");
    const key = after ?? "first";
    const body = pages[key];
    if (!body) throw new Error("unexpected url: " + url);
    return {
      ok: true,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
}

const reel = (id: string) => ({
  id,
  media_product_type: "REELS",
  timestamp: "2026-06-01T00:00:00+0000",
});

const nextUrl = (cursor: string) =>
  `https://graph.instagram.com/v23.0/me/media?after=${cursor}&access_token=tok`;

test("listMedia는 limit=100으로 첫 페이지를 요청하고 paging.next를 끝까지 따라간다", async () => {
  const calls: string[] = [];
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: pagedFetch(
      {
        first: {
          data: [reel("r1"), { id: "f1", media_product_type: "FEED", timestamp: "2026-06-01T00:00:00+0000" }],
          paging: { next: nextUrl("cursor-2") },
        },
        "cursor-2": {
          data: [reel("r2")],
          paging: { next: nextUrl("cursor-3") },
        },
        "cursor-3": { data: [reel("r3")] },
      },
      calls,
    ) as unknown as typeof fetch,
  });

  const { analyzable: reels } = await client.listMedia();
  expect(reels.map((m) => m.id)).toEqual(["r1", "r2", "r3"]);
  expect(calls).toHaveLength(3);
  expect(calls[0]).toContain("limit=100");
  expect(calls[1]).toContain("after=cursor-2");
});

test("paging.next가 없으면 첫 페이지만 요청하고 멈춘다", async () => {
  const calls: string[] = [];
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: pagedFetch(
      { first: { data: [reel("r1"), reel("r2")] } },
      calls,
    ) as unknown as typeof fetch,
  });

  const { analyzable: reels } = await client.listMedia();
  expect(reels.map((m) => m.id)).toEqual(["r1", "r2"]);
  expect(calls).toHaveLength(1);
});

test("paging.next 커서가 반복되면 무한 반복 대신 명시적으로 실패한다", async () => {
  const calls: string[] = [];
  const repeated = nextUrl("same-cursor");
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: pagedFetch(
      {
        first: { data: [reel("r1")], paging: { next: repeated } },
        "same-cursor": { data: [reel("r2")], paging: { next: repeated } },
      },
      calls,
    ) as unknown as typeof fetch,
  });

  await expect(client.listMedia()).rejects.toThrow(/커서가 반복/);
  expect(calls).toHaveLength(2);
});

test("릴스가 500개를 넘어도 paging.next가 끝날 때까지 모두 가져온다", async () => {
  const calls: string[] = [];
  const pages: Record<string, unknown> = {};
  for (let i = 0; i < 6; i++) {
    pages[i === 0 ? "first" : `cursor-${i}`] = {
      data: Array.from({ length: 100 }, (_, j) => reel(`p${i}-r${j}`)),
      ...(i < 5 ? { paging: { next: nextUrl(`cursor-${i + 1}`) } } : {}),
    };
  }
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: pagedFetch(pages, calls) as unknown as typeof fetch,
  });

  const { analyzable: reels } = await client.listMedia();
  expect(reels).toHaveLength(600);
  expect(calls).toHaveLength(6);
});

test("페이지 상한(20)에 도달했는데 paging.next가 남으면 명시적으로 실패한다", async () => {
  const calls: string[] = [];
  const pages: Record<string, unknown> = {};
  for (let i = 0; i < 25; i++) {
    pages[i === 0 ? "first" : `cursor-${i}`] = {
      data: Array.from({ length: 10 }, (_, j) => reel(`p${i}-r${j}`)),
      paging: { next: nextUrl(`cursor-${i + 1}`) },
    };
  }
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: pagedFetch(pages, calls) as unknown as typeof fetch,
  });

  await expect(client.listMedia()).rejects.toThrow(/상한|완전한 목록/);
  expect(calls).toHaveLength(20);
});

test("페이지 상한 오류 메시지에 paging.next의 액세스 토큰을 노출하지 않는다", async () => {
  const secret = "sensitive-token-must-not-leak";
  const pages: Record<string, unknown> = {};
  for (let i = 0; i < 25; i++) {
    pages[i === 0 ? "first" : `cursor-${i}`] = {
      data: [reel(`p${i}`)],
      paging: {
        next: `https://graph.instagram.com/v23.0/me/media?after=cursor-${i + 1}&access_token=${secret}`,
      },
    };
  }
  const client = createGraphClient({
    accessToken: secret,
    fetchImpl: pagedFetch(pages, []) as unknown as typeof fetch,
  });

  const error = await client.listMedia().catch((caught: unknown) => caught);
  expect(String(error)).not.toContain(secret);
});

test("다음 페이지 응답이 ok=false면 Graph 오류 메시지로 throw", async () => {
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: (async (url: string) => {
      if (url.includes("after=")) {
        return {
          ok: false,
          json: async () => ({ error: { message: "토큰 만료" } }),
          text: async () => "",
        };
      }
      return {
        ok: true,
        json: async () => ({ data: [reel("r1")], paging: { next: nextUrl("cursor-2") } }),
        text: async () => "",
      };
    }) as unknown as typeof fetch,
  });

  await expect(client.listMedia()).rejects.toThrow(/토큰 만료/);
});
