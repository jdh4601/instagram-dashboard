import {
  syncApplicationsIfConfigured,
  syncWallaApplications,
  WALLA_MAX_PAGES,
} from "@/lib/walla/sync";
import type { WallaClient } from "@/lib/walla/client";
import type { ApplicationRepository } from "@/lib/store/applicationRepository";
import type { Application } from "@/lib/schemas";

const FIELDS = [
  { fieldId: "f1", label: "utm_source" },
  { fieldId: "f2", label: "utm_medium" },
];

function row(responseId: string, extra: Record<string, unknown> = {}) {
  return {
    responseId,
    submittedAt: "2026-07-30T14:30:00Z",
    "hidden-f1": "instagram",
    "hidden-f2": "bio",
    ...extra,
  };
}

/** 페이지 배열을 순서대로 돌려주는 가짜 클라이언트. */
function fakeClient(pages: ReturnType<typeof row>[][], counters = { fields: 0, responses: 0 }) {
  const client: WallaClient = {
    async listFields() {
      counters.fields += 1;
      return FIELDS;
    },
    async listResponses(_formId, { page }) {
      counters.responses += 1;
      return { responses: pages[page - 1] ?? [], totalPages: pages.length };
    },
  };
  return { client, counters };
}

function memoryRepo(seed: Application[] = []) {
  let stored = [...seed];
  const repo: ApplicationRepository = {
    async list() {
      return stored;
    },
    async upsertMany(applications) {
      const byId = new Map(stored.map((a) => [a.responseId, a]));
      for (const application of applications) byId.set(application.responseId, application);
      stored = [...byId.values()];
      return applications.length;
    },
  };
  return { repo, current: () => stored };
}

test("여러 페이지를 끝까지 따라가 모두 저장한다", async () => {
  const { client, counters } = fakeClient([[row("r1"), row("r2")], [row("r3")]]);
  const { repo, current } = memoryRepo();

  const result = await syncWallaApplications(client, repo, "form_1");

  expect(result.fetched).toBe(3);
  expect(result.pages).toBe(2);
  expect(counters.responses).toBe(2);
  expect(current().map((a) => a.responseId)).toEqual(["r1", "r2", "r3"]);
});

test("필드 목록은 페이지마다가 아니라 한 번만 조회한다", async () => {
  const { client, counters } = fakeClient([[row("r1")], [row("r2")], [row("r3")]]);
  const { repo } = memoryRepo();

  await syncWallaApplications(client, repo, "form_1");

  expect(counters.fields).toBe(1);
});

test("숨김 필드를 UTM으로 변환해 저장한다", async () => {
  const { client } = fakeClient([[row("r1")]]);
  const { repo, current } = memoryRepo();

  await syncWallaApplications(client, repo, "form_1");

  expect(current()[0]).toEqual({
    responseId: "r1",
    submittedAt: "2026-07-30T14:30:00Z",
    source: "instagram",
    medium: "bio",
  });
});

test("같은 responseId가 두 페이지에 걸쳐 오면 한 번만 센다", async () => {
  // 동기화 도중 새 신청이 들어오면 페이지 경계가 밀려 같은 행이 다시 나온다.
  const { client } = fakeClient([[row("r1"), row("r2")], [row("r2"), row("r3")]]);
  const { repo, current } = memoryRepo();

  const result = await syncWallaApplications(client, repo, "form_1");

  expect(result.fetched).toBe(3);
  expect(current().map((a) => a.responseId)).toEqual(["r1", "r2", "r3"]);
});

test("재동기화해도 기존 신청이 중복으로 쌓이지 않는다", async () => {
  const { client } = fakeClient([[row("r1")]]);
  const { repo, current } = memoryRepo();

  await syncWallaApplications(client, repo, "form_1");
  await syncWallaApplications(client, repo, "form_1");

  expect(current()).toHaveLength(1);
});

test("페이지 수가 상한을 넘으면 거기서 멈춘다", async () => {
  // 폼이 오래돼 응답이 수만 건이면 한 번의 동기화가 API를 끝없이 두드린다.
  const pages = Array.from({ length: WALLA_MAX_PAGES + 5 }, (_, i) => [row(`r${i}`)]);
  const { client, counters } = fakeClient(pages);
  const { repo } = memoryRepo();

  const result = await syncWallaApplications(client, repo, "form_1");

  expect(counters.responses).toBe(WALLA_MAX_PAGES);
  expect(result.pages).toBe(WALLA_MAX_PAGES);
  expect(result.reachedPageLimit).toBe(true);
});

test("상한에 닿지 않으면 reachedPageLimit이 거짓이다", async () => {
  const { client } = fakeClient([[row("r1")]]);
  const { repo } = memoryRepo();

  expect((await syncWallaApplications(client, repo, "form_1")).reachedPageLimit).toBe(false);
});

test("신청이 하나도 없어도 오류 없이 끝난다", async () => {
  const { client } = fakeClient([[]]);
  const { repo, current } = memoryRepo();

  const result = await syncWallaApplications(client, repo, "form_1");

  expect(result.fetched).toBe(0);
  expect(current()).toHaveLength(0);
});

test("UTM 숨김 필드가 하나도 없는 폼도 신청 수는 센다", async () => {
  // UTM을 붙이기 전 기간이다. 전환율은 못 내도 총 신청 수는 알아야 한다.
  const client: WallaClient = {
    async listFields() {
      return [{ fieldId: "f9", label: "이름" }];
    },
    async listResponses() {
      return {
        responses: [{ responseId: "r1", submittedAt: "2026-07-30T14:30:00Z", "hidden-f9": "홍길동" }],
        totalPages: 1,
      };
    },
  };
  const { repo, current } = memoryRepo();

  const result = await syncWallaApplications(client, repo, "form_1");

  expect(result.fetched).toBe(1);
  expect(current()[0].source).toBeUndefined();
  expect(JSON.stringify(current())).not.toContain("홍길동");
});

// ── 동기화 배선(선택 기능이라 실패가 전체를 죽이면 안 된다) ──────────────

test("Walla 미설정이면 조용히 건너뛴다", async () => {
  const { repo } = memoryRepo();

  const result = await syncApplicationsIfConfigured(null, repo);

  expect(result.applications).toBeNull();
  expect(result.error).toBeNull();
});

test("연결돼 있으면 신청 수를 돌려준다", async () => {
  const { client } = fakeClient([[row("r1"), row("r2")]]);
  const { repo } = memoryRepo();

  const result = await syncApplicationsIfConfigured({ client, formId: "form_1" }, repo);

  expect(result.applications).toBe(2);
  expect(result.error).toBeNull();
});

test("Walla가 실패해도 던지지 않고 오류만 담아 준다", async () => {
  // Instagram 동기화가 본 작업이다. 신청 폼 장애로 릴스 지표까지 날리면 안 된다.
  const client: WallaClient = {
    async listFields() {
      throw new Error("Walla 요청 실패 (401): /forms/form_1/fields");
    },
    async listResponses() {
      return { responses: [], totalPages: 1 };
    },
  };
  const { repo } = memoryRepo();

  const result = await syncApplicationsIfConfigured({ client, formId: "form_1" }, repo);

  expect(result.applications).toBeNull();
  expect(result.error).toContain("401");
});

test("페이지 상한에 걸린 사실을 결과에 남긴다", async () => {
  const pages = Array.from({ length: WALLA_MAX_PAGES + 1 }, (_, i) => [row(`r${i}`)]);
  const { client } = fakeClient(pages);
  const { repo } = memoryRepo();

  const result = await syncApplicationsIfConfigured({ client, formId: "form_1" }, repo);

  expect(result.reachedPageLimit).toBe(true);
});
