import { adUnitStatus, goalLabel } from "@/lib/ui/adUnitLabels";

const NOW = new Date("2026-09-02T10:00:00+0900");

test("집행 중과 심사 중과 종료를 가른다", () => {
  expect(adUnitStatus({ status: "ACTIVE", endTime: "2026-09-04T00:00:00+0900" }, NOW)).toMatchObject(
    { label: "집행 중" },
  );
  expect(adUnitStatus({ status: "PENDING_REVIEW" }, NOW)).toMatchObject({ label: "심사 중" });
  expect(adUnitStatus({ status: "PAUSED" }, NOW)).toMatchObject({ label: "일시중지" });
});

// Meta는 기간이 끝난 광고도 ACTIVE로 답한다. 상태만 믿으면 지난달에 끝난 광고가
// 지금 돈을 쓰고 있는 것처럼 보인다.
test("기간이 지난 광고는 상태가 ACTIVE여도 종료로 본다", () => {
  const done = adUnitStatus({ status: "ACTIVE", endTime: "2026-08-30T00:00:00+0900" }, NOW);

  expect(done.label).toBe("종료");
});

test("반려와 문제 있음은 눈에 띄게 표시한다", () => {
  expect(adUnitStatus({ status: "DISAPPROVED" }, NOW)).toMatchObject({
    label: "반려됨",
    band: "weak",
  });
  expect(adUnitStatus({ status: "WITH_ISSUES" }, NOW)).toMatchObject({ band: "weak" });
});

test("모르는 상태는 원문을 그대로 보여 준다", () => {
  const unknown = adUnitStatus({ status: "SOME_NEW_STATUS" }, NOW);

  expect(unknown.label).toBe("SOME_NEW_STATUS");
  expect(unknown.band).toBeUndefined();
});

test("목표는 한국어로 적고 모르는 목표는 원문을 남긴다", () => {
  expect(goalLabel("THRUPLAY")).toBe("동영상 조회");
  expect(goalLabel("LINK_CLICKS")).toBe("링크 클릭");
  expect(goalLabel("SOME_NEW_GOAL")).toBe("SOME_NEW_GOAL");
  expect(goalLabel(null)).toBe("—");
});
