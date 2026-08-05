import { WallaRequestError } from "@/lib/walla/client";
import { probeWallaConnection } from "@/lib/walla/probe";
import type { WallaClient } from "@/lib/walla/client";
import type { WallaField } from "@/lib/walla/map";

function clientReturning(fields: WallaField[]): WallaClient {
  return {
    listFields: async () => fields,
    listResponses: async () => ({ responses: [], totalPages: 1 }),
  };
}

function clientThrowing(error: unknown): WallaClient {
  return {
    listFields: async () => {
      throw error;
    },
    listResponses: async () => ({ responses: [], totalPages: 1 }),
  };
}

test("필드를 읽어 오면 성공이고 인식된 UTM 축을 함께 알린다", async () => {
  const result = await probeWallaConnection(
    clientReturning([
      { fieldId: "f1", label: "utm_source" },
      { fieldId: "f2", label: "utm_medium" },
      { fieldId: "f3", label: "이름" },
    ]),
    "form_1",
  );

  expect(result).toEqual({
    ok: true,
    fieldCount: 3,
    utmKeys: ["source", "medium"],
    missingUtmKeys: ["campaign", "content"],
  });
});

/**
 * 인증만 통과하고 숨김 필드가 없으면 신청 수는 세지만 전환율은 영영 0%다.
 * 연결 테스트가 "성공"만 말하고 끝나면 사용자는 그 사실을 동기화를 몇 번 돌린
 * 뒤에야 눈치챈다 — 이 버튼을 만드는 이유의 절반이 여기에 있다.
 */
test("UTM 숨김 필드가 하나도 없어도 연결 자체는 성공으로 본다", async () => {
  const result = await probeWallaConnection(
    clientReturning([{ fieldId: "f1", label: "이름" }]),
    "form_1",
  );

  expect(result).toEqual({
    ok: true,
    fieldCount: 1,
    utmKeys: [],
    missingUtmKeys: ["source", "medium", "campaign", "content"],
  });
});

test("한글 별칭으로 적은 숨김 필드도 UTM으로 인식한다", async () => {
  const result = await probeWallaConnection(
    clientReturning([{ fieldId: "f1", label: "유입경로" }]),
    "form_1",
  );

  expect(result.ok && result.utmKeys).toEqual(["source"]);
});

test("401이면 키 문제로 판정한다", async () => {
  const result = await probeWallaConnection(
    clientThrowing(new WallaRequestError(401, "/forms/form_1/fields")),
    "form_1",
  );

  expect(result.ok).toBe(false);
  expect(result.ok === false && result.reason).toBe("unauthorized");
  expect(result.ok === false && result.message).toContain("API 키");
});

test("403도 키 문제로 함께 묶는다", async () => {
  const result = await probeWallaConnection(
    clientThrowing(new WallaRequestError(403, "/forms/form_1/fields")),
    "form_1",
  );

  expect(result.ok === false && result.reason).toBe("unauthorized");
});

test("404면 폼 ID 문제로 판정한다 — 키가 아니라 폼을 고쳐야 한다", async () => {
  const result = await probeWallaConnection(
    clientThrowing(new WallaRequestError(404, "/forms/form_1/fields")),
    "form_1",
  );

  expect(result.ok === false && result.reason).toBe("formNotFound");
  expect(result.ok === false && result.message).toContain("폼 ID");
});

test("그 밖의 상태 코드는 Walla 쪽 오류로 상태 코드와 함께 알린다", async () => {
  const result = await probeWallaConnection(
    clientThrowing(new WallaRequestError(500, "/forms/form_1/fields")),
    "form_1",
  );

  expect(result.ok === false && result.reason).toBe("requestFailed");
  expect(result.ok === false && result.message).toContain("500");
});

test("네트워크 오류는 연결 실패로 구분한다", async () => {
  const result = await probeWallaConnection(clientThrowing(new Error("fetch failed")), "form_1");

  expect(result.ok === false && result.reason).toBe("unreachable");
});

/** 실패 문구에 키가 섞여 나가면 화면·로그·스크린샷으로 새어 나간다. */
test("실패 문구에 자격증명을 담지 않는다", async () => {
  const secret = "sk-do-not-leak-0000";
  const result = await probeWallaConnection(clientThrowing(new Error(secret)), "form_1");

  expect(result.ok === false && result.message).not.toContain(secret);
});
