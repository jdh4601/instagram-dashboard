import { readNdjson } from "@/lib/ui/ndjsonStream";
import { buildSyncToast } from "@/lib/ui/syncToast";

const ok = {
  syncedReels: 42,
  failedReels: 0,
  removedReels: 0,
  errors: [] as string[],
  username: "donghyun",
  unavailableMetrics: [] as string[],
};

test("실패도 오류도 없으면 성공 알림이다", () => {
  expect(buildSyncToast(ok)).toEqual({
    tone: "success",
    message: "동기화 완료: 게시물 42개 · @donghyun",
  });
});

test("정리된 게시물과 미지원 지표는 성공 문구에 덧붙는다", () => {
  const toast = buildSyncToast({ ...ok, removedReels: 3, unavailableMetrics: ["shares", "saves"] });
  expect(toast.tone).toBe("success");
  expect(toast.message).toBe(
    "동기화 완료: 게시물 42개 · @donghyun · 삭제된 게시물 3개 정리 · 선택 지표 2개 미지원",
  );
});

test("게시물 동기화가 일부 실패하면 경고로 낮추고 사유를 밝힌다", () => {
  const toast = buildSyncToast({
    ...ok,
    failedReels: 2,
    errors: ["17901: 지표 없음", "17902: 타임아웃"],
  });
  expect(toast.tone).toBe("warning");
  expect(toast.message).toBe(
    "동기화 일부 실패: 게시물 2개를 가져오지 못했습니다 — 17901: 지표 없음 / 17902: 타임아웃",
  );
});

test("실패 사유는 앞의 두 건까지만 싣는다 — 토스트 한 줄을 넘기지 않는다", () => {
  const toast = buildSyncToast({ ...ok, failedReels: 3, errors: ["a", "b", "c"] });
  expect(toast.message).toContain("a / b");
  expect(toast.message).not.toContain("c");
});

/**
 * 회귀 방지: 신청 폼(Walla) 연동이 통째로 실패해도 릴스가 다 성공하면 failedReels는
 * 0이다. 이 경우를 성공으로 처리하면 사용자는 초록 "동기화 완료"만 보고 신청 수가
 * 왜 그대로인지 알 길이 없다 — 401이 몇 주째 조용히 반복되던 실제 사고다.
 */
test("게시물이 다 성공해도 오류가 남아 있으면 성공으로 알리지 않는다", () => {
  const toast = buildSyncToast({
    ...ok,
    errors: ["Walla 요청 실패 (401): /forms/abc/fields"],
  });
  expect(toast.tone).toBe("warning");
  expect(toast.message).toBe(
    "동기화 완료: 게시물 42개 · @donghyun — 신청 폼 실패: Walla 요청 실패 (401): /forms/abc/fields",
  );
});

test("신청 폼만 실패해도 성공한 게시물 수는 그대로 알린다", () => {
  const toast = buildSyncToast({
    ...ok,
    removedReels: 1,
    errors: ["신청 폼 동기화 실패"],
  });
  expect(toast.message).toContain("게시물 42개 · @donghyun");
  expect(toast.message).toContain("삭제된 게시물 1개 정리");
  expect(toast.message).toContain("신청 폼 실패: 신청 폼 동기화 실패");
});

/**
 * 입력은 NDJSON 스트림에서 온 신뢰할 수 없는 값이다. 필드가 빠지거나 타입이 달라도
 * 알림 자체가 깨지면 사용자는 동기화 결과를 아무것도 알 수 없게 된다.
 */
test("필드가 빠지거나 타입이 어긋나도 알림을 만든다", () => {
  expect(buildSyncToast({}).tone).toBe("success");
  const toast = buildSyncToast({ failedReels: "2", errors: "오류", syncedReels: null });
  expect(toast.tone).toBe("success");
  expect(toast.message).toContain("동기화 완료");
});

test("문자열이 아닌 오류 항목은 문구에서 걸러낸다", () => {
  const toast = buildSyncToast({ ...ok, errors: [null, "진짜 오류", 42] });
  expect(toast.tone).toBe("warning");
  expect(toast.message).toBe("동기화 완료: 게시물 42개 · @donghyun — 신청 폼 실패: 진짜 오류");
});

function resultStream(payload: unknown): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`${JSON.stringify(payload)}\n`));
      controller.close();
    },
  });
}

/**
 * 라우트가 흘려보내는 이벤트가 그대로 알림이 되는지 잇는 지점까지 확인한다.
 * 단위 문구가 맞아도 이 배선이 빠지면 사용자에게는 아무것도 달라지지 않는다.
 * (라우트가 errors에 Walla 실패를 싣는 것은 apiSync.test.ts가 보장한다.)
 */
test("스트림 result 이벤트가 신청 폼 실패를 경고로 전달한다", async () => {
  const stream = resultStream({
    type: "result",
    syncedReels: 42,
    failedReels: 0,
    removedReels: 0,
    errors: ["Walla 요청 실패 (401): /forms/form_1/fields"],
    followerCount: 1200,
    username: "donghyun",
    availableMetrics: [],
    unavailableMetrics: [],
    applications: null,
  });

  let data: unknown = null;
  for await (const event of readNdjson(stream)) {
    if ((event as { type?: string }).type === "result") data = event;
  }

  expect(buildSyncToast(data as Parameters<typeof buildSyncToast>[0])).toEqual({
    tone: "warning",
    message:
      "동기화 완료: 게시물 42개 · @donghyun — 신청 폼 실패: Walla 요청 실패 (401): /forms/form_1/fields",
  });
});
