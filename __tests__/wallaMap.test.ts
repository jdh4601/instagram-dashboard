import { buildHiddenFieldMap, toApplication } from "@/lib/walla/map";

const FIELDS = [
  { fieldId: "f_utm_source", label: "utm_source" },
  { fieldId: "f_utm_medium", label: "utm_medium" },
  { fieldId: "f_utm_campaign", label: "utm_campaign" },
  { fieldId: "f_name", label: "이름" },
];

test("숨김 필드 라벨을 정규 UTM 키로 매핑한다", () => {
  const map = buildHiddenFieldMap(FIELDS);

  expect(map.get("hidden-f_utm_source")).toBe("source");
  expect(map.get("hidden-f_utm_medium")).toBe("medium");
  expect(map.get("hidden-f_utm_campaign")).toBe("campaign");
});

test("UTM으로 해석되지 않는 필드는 매핑에서 제외한다", () => {
  const map = buildHiddenFieldMap(FIELDS);

  // 이름·연락처 같은 응답 본문은 신청자 개인정보다. 대시보드는 집계만 하므로
  // 매핑하지 않아 저장 단계까지 흘러가지 않는다.
  expect(map.has("hidden-f_name")).toBe(false);
});

test("라벨 표기 흔들림(대소문자·공백·utm 접두사 생략)을 흡수한다", () => {
  const map = buildHiddenFieldMap([
    { fieldId: "a", label: "UTM Source" },
    { fieldId: "b", label: "medium" },
    { fieldId: "c", label: "캠페인" },
  ]);

  expect(map.get("hidden-a")).toBe("source");
  expect(map.get("hidden-b")).toBe("medium");
  expect(map.get("hidden-c")).toBe("campaign");
});

test("한글로 적은 숨김 필드 라벨도 인식한다", () => {
  const map = buildHiddenFieldMap([
    { fieldId: "a", label: "유입경로" },
    { fieldId: "b", label: "유입매체" },
  ]);

  expect(map.get("hidden-a")).toBe("source");
  expect(map.get("hidden-b")).toBe("medium");
});

test("같은 정규 키에 필드가 둘이면 먼저 정의된 필드를 쓴다", () => {
  // 폼을 고치다 보면 같은 뜻의 숨김 필드가 둘 남는 일이 있다. 뒤엣것이
  // 조용히 이기면 어느 링크가 반영됐는지 설명할 수 없어 순서를 고정한다.
  const map = buildHiddenFieldMap([
    { fieldId: "old", label: "source" },
    { fieldId: "new", label: "utm_source" },
  ]);

  expect(map.get("hidden-old")).toBe("source");
  expect(map.has("hidden-new")).toBe(false);
});

test("응답 행을 Application으로 변환한다", () => {
  const map = buildHiddenFieldMap(FIELDS);
  const application = toApplication(
    {
      responseId: "resp_1",
      submittedAt: "2026-07-30T14:30:00Z",
      "hidden-f_utm_source": "instagram",
      "hidden-f_utm_medium": "bio",
      "hidden-f_utm_campaign": "2026q3",
      "hidden-f_name": "홍길동",
      field_001: "010-0000-0000",
    },
    map,
  );

  expect(application).toEqual({
    responseId: "resp_1",
    submittedAt: "2026-07-30T14:30:00Z",
    source: "instagram",
    medium: "bio",
    campaign: "2026q3",
  });
});

test("신청자 응답 본문은 Application에 담지 않는다", () => {
  const map = buildHiddenFieldMap(FIELDS);
  const application = toApplication(
    {
      responseId: "resp_1",
      submittedAt: "2026-07-30T14:30:00Z",
      "hidden-f_name": "홍길동",
      field_001: "010-0000-0000",
    },
    map,
  );

  expect(JSON.stringify(application)).not.toContain("홍길동");
  expect(JSON.stringify(application)).not.toContain("010-0000-0000");
});

test("UTM 없이 들어온 신청도 버리지 않는다", () => {
  // 링크를 직접 친 사람, UTM을 붙이기 전에 들어온 사람이 있다. 분자에서
  // 빼면 총 신청 수가 실제와 어긋나므로 출처 미상으로 남긴다.
  const application = toApplication(
    { responseId: "resp_2", submittedAt: "2026-07-30T14:30:00Z" },
    buildHiddenFieldMap(FIELDS),
  );

  expect(application.responseId).toBe("resp_2");
  expect(application.source).toBeUndefined();
  expect(application.medium).toBeUndefined();
});

test("빈 문자열 UTM은 값이 없는 것으로 다룬다", () => {
  const application = toApplication(
    {
      responseId: "resp_3",
      submittedAt: "2026-07-30T14:30:00Z",
      "hidden-f_utm_source": "  ",
      "hidden-f_utm_medium": "",
    },
    buildHiddenFieldMap(FIELDS),
  );

  expect(application.source).toBeUndefined();
  expect(application.medium).toBeUndefined();
});

test("UTM 값 대소문자를 소문자로 통일한다", () => {
  // 광고 담당자가 링크를 손으로 만들면 Instagram/instagram이 섞인다.
  // 통일하지 않으면 medium 집계가 둘로 쪼개진다.
  const application = toApplication(
    {
      responseId: "resp_4",
      submittedAt: "2026-07-30T14:30:00Z",
      "hidden-f_utm_source": "Instagram",
      "hidden-f_utm_medium": "BIO",
    },
    buildHiddenFieldMap(FIELDS),
  );

  expect(application.source).toBe("instagram");
  expect(application.medium).toBe("bio");
});
