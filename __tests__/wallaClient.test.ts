import { createWallaClient, type WallaFetchResult } from "@/lib/walla/client";

interface Call {
  url: string;
  headers: Record<string, string>;
}

/** 호출을 기록하면서 URL 패턴별 가짜 응답을 돌려주는 fetch 목. */
function fakeFetch(routes: Record<string, unknown>, calls: Call[] = []) {
  return async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error("unexpected url: " + url);
    return {
      ok: true,
      status: 200,
      json: async () => routes[key],
      text: async () => JSON.stringify(routes[key]),
    } as WallaFetchResult;
  };
}

const RESPONSES_PAGE = {
  success: true,
  data: {
    responses: [
      { responseId: "resp_1", submittedAt: "2026-07-30T14:30:00Z", "hidden-f1": "instagram" },
    ],
    pagination: { page: 1, limit: 100, totalCount: 1, totalPages: 1 },
  },
};

test("모든 요청에 X-WALLA-API-KEY 헤더를 붙인다", async () => {
  const calls: Call[] = [];
  const client = createWallaClient({
    apiKey: "wk_secret",
    fetchImpl: fakeFetch({ "/responses": RESPONSES_PAGE }, calls),
  });

  await client.listResponses("form_1", { page: 1 });

  expect(calls[0].headers["X-WALLA-API-KEY"]).toBe("wk_secret");
});

test("응답 봉투(success/data)를 벗겨 responses와 totalPages를 반환한다", async () => {
  const client = createWallaClient({
    apiKey: "wk",
    fetchImpl: fakeFetch({ "/responses": RESPONSES_PAGE }),
  });

  const page = await client.listResponses("form_1", { page: 1 });

  expect(page.responses).toHaveLength(1);
  expect(page.responses[0].responseId).toBe("resp_1");
  expect(page.totalPages).toBe(1);
});

test("limit은 API 상한인 100을 넘기지 않는다", async () => {
  const calls: Call[] = [];
  const client = createWallaClient({
    apiKey: "wk",
    fetchImpl: fakeFetch({ "/responses": RESPONSES_PAGE }, calls),
  });

  await client.listResponses("form_1", { page: 1, limit: 500 });

  expect(calls[0].url).toContain("limit=100");
});

test("formId를 URL에 인코딩해 넣는다", async () => {
  const calls: Call[] = [];
  const client = createWallaClient({
    apiKey: "wk",
    fetchImpl: fakeFetch({ "/responses": RESPONSES_PAGE }, calls),
  });

  await client.listResponses("form/1", { page: 1 });

  expect(calls[0].url).toContain("/forms/form%2F1/responses");
});

test("실패 응답은 상태 코드를 담아 오류로 던진다", async () => {
  const client = createWallaClient({
    apiKey: "wk_secret",
    fetchImpl: async () =>
      ({
        ok: false,
        status: 401,
        json: async () => ({ success: false }),
        text: async () => "unauthorized",
      }) as WallaFetchResult,
  });

  await expect(client.listResponses("form_1", { page: 1 })).rejects.toThrow(/401/);
});

test("오류 메시지에 API 키를 노출하지 않는다", async () => {
  // 오류는 화면과 로그로 나간다. 키가 섞여 나가면 회수할 방법이 없다.
  const client = createWallaClient({
    apiKey: "wk_supersecret",
    fetchImpl: async () =>
      ({
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => "server error: key wk_supersecret rejected",
      }) as WallaFetchResult,
  });

  const error = await client.listResponses("form_1", { page: 1 }).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).not.toContain("wk_supersecret");
});

test("fetch 자체가 던진 오류의 원문도 흘리지 않는다", async () => {
  const client = createWallaClient({
    apiKey: "wk_supersecret",
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED (X-WALLA-API-KEY: wk_supersecret)");
    },
  });

  const error = await client.listResponses("form_1", { page: 1 }).catch((e: unknown) => e);

  expect((error as Error).message).not.toContain("wk_supersecret");
});

test("필드 목록을 fieldId/label로 정규화한다", async () => {
  const client = createWallaClient({
    apiKey: "wk",
    fetchImpl: fakeFetch({
      "/fields": {
        success: true,
        data: {
          fields: [
            { fieldId: "f1", label: "utm_source" },
            { fieldId: "f2", label: "이름" },
          ],
        },
      },
    }),
  });

  const fields = await client.listFields("form_1");

  expect(fields).toEqual([
    { fieldId: "f1", label: "utm_source" },
    { fieldId: "f2", label: "이름" },
  ]);
});

test("필드 응답의 키 이름이 id/title이어도 읽는다", async () => {
  // 문서에 필드 응답 스키마가 없어 실물 확인 전까지 흔한 표기를 함께 받는다.
  const client = createWallaClient({
    apiKey: "wk",
    fetchImpl: fakeFetch({
      "/fields": {
        success: true,
        data: { fields: [{ id: "f1", title: "utm_source" }] },
      },
    }),
  });

  expect(await client.listFields("form_1")).toEqual([{ fieldId: "f1", label: "utm_source" }]);
});

test("필드 목록이 배열로 바로 오는 형태도 읽는다", async () => {
  const client = createWallaClient({
    apiKey: "wk",
    fetchImpl: fakeFetch({
      "/fields": { success: true, data: [{ fieldId: "f1", label: "utm_source" }] },
    }),
  });

  expect(await client.listFields("form_1")).toEqual([{ fieldId: "f1", label: "utm_source" }]);
});

test("라벨이 없는 필드는 건너뛴다", async () => {
  const client = createWallaClient({
    apiKey: "wk",
    fetchImpl: fakeFetch({
      "/fields": {
        success: true,
        data: { fields: [{ fieldId: "f1" }, { fieldId: "f2", label: "utm_medium" }] },
      },
    }),
  });

  expect(await client.listFields("form_1")).toEqual([{ fieldId: "f2", label: "utm_medium" }]);
});
