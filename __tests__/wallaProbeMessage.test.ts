import { describeWallaProbe } from "@/lib/ui/wallaProbeMessage";

test("모든 UTM 축이 잡히면 성공으로 알린다", () => {
  expect(
    describeWallaProbe({
      ok: true,
      fieldCount: 6,
      utmKeys: ["source", "medium", "campaign", "content"],
      missingUtmKeys: [],
    }),
  ).toEqual({ tone: "success", message: "연결됨 — 필드 6개, UTM 숨김 필드 4개 모두 인식됨" });
});

/**
 * medium은 신청 전환율(applyRate)의 분자를 가르는 축이다. 이게 없으면 인증이
 * 통해도 전환율은 영영 0%다 — 성공이라고만 알리면 사용자를 속이는 셈이다.
 */
test("medium이 없으면 연결돼도 경고한다 — 전환율이 나오지 않는다", () => {
  const notice = describeWallaProbe({
    ok: true,
    fieldCount: 3,
    utmKeys: ["source"],
    missingUtmKeys: ["medium", "campaign", "content"],
  });

  expect(notice.tone).toBe("warning");
  expect(notice.message).toContain("utm_medium");
  expect(notice.message).toContain("전환율");
});

test("medium이 있으면 나머지 축이 빠져도 성공이되 누락을 밝힌다", () => {
  const notice = describeWallaProbe({
    ok: true,
    fieldCount: 4,
    utmKeys: ["source", "medium"],
    missingUtmKeys: ["campaign", "content"],
  });

  expect(notice.tone).toBe("success");
  expect(notice.message).toContain("utm_campaign, utm_content");
});

test("UTM 필드가 하나도 없으면 신청 수만 집계된다고 알린다", () => {
  const notice = describeWallaProbe({
    ok: true,
    fieldCount: 2,
    utmKeys: [],
    missingUtmKeys: ["source", "medium", "campaign", "content"],
  });

  expect(notice.tone).toBe("warning");
  expect(notice.message).toContain("신청 수만");
});

test("실패는 probe가 준 문구를 그대로 오류로 띄운다", () => {
  expect(
    describeWallaProbe({
      ok: false,
      reason: "unauthorized",
      message: "API 키가 거부되었습니다 — 키가 만료되었거나 잘못되었습니다.",
    }),
  ).toEqual({
    tone: "error",
    message: "API 키가 거부되었습니다 — 키가 만료되었거나 잘못되었습니다.",
  });
});
