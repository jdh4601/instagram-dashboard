import { adUnitMetrics, type AdUnitMetricsInput } from "@/lib/analysis/adUnitMetrics";

function input(over: Partial<AdUnitMetricsInput> = {}): AdUnitMetricsInput {
  return {
    spend: 3427,
    impressions: 698,
    reach: 600,
    clicks: 85,
    engagements: 48,
    ...over,
  };
}

test("지출·노출·도달·클릭·참여에서 효율 지표 여섯 개를 만든다", () => {
  const m = adUnitMetrics(input());

  expect(m.cpm).toBeCloseTo(4909.7, 1); // 3427/698*1000
  expect(m.cpc).toBeCloseTo(40.32, 2); // 3427/85
  expect(m.ctr).toBeCloseTo(12.18, 2); // 85/698*100
  expect(m.frequency).toBeCloseTo(1.163, 3); // 698/600
  expect(m.engagementRate).toBeCloseTo(8, 5); // 48/600*100
  expect(m.costPerEngagement).toBeCloseTo(71.4, 1); // 3427/48
});

test("노출이 없으면 CPM과 클릭률을 만들 수 없다", () => {
  // 심사 중이라 아직 한 번도 안 뜬 광고다. 0으로 채우면 "노출당 0원에 샀다"로 읽힌다.
  const m = adUnitMetrics(input({ impressions: 0, clicks: 0 }));

  expect(m.cpm).toBeNull();
  expect(m.ctr).toBeNull();
});

test("도달이 없으면 빈도와 참여율을 만들 수 없다", () => {
  const m = adUnitMetrics(input({ reach: 0 }));

  expect(m.frequency).toBeNull();
  expect(m.engagementRate).toBeNull();
});

test("클릭이 없으면 클릭당 비용을 만들 수 없다", () => {
  const m = adUnitMetrics(input({ clicks: 0 }));

  expect(m.cpc).toBeNull();
  // 클릭이 0인 것은 아는 사실이므로 클릭률은 0%로 적는다. null이 아니다.
  expect(m.ctr).toBe(0);
});

test("참여를 한 줄도 못 받으면 참여율과 참여 단가가 둘 다 없다", () => {
  // engagements가 null인 것은 "반응이 없었다"가 아니라 "모른다"는 뜻이다.
  const m = adUnitMetrics(input({ engagements: null }));

  expect(m.engagementRate).toBeNull();
  expect(m.costPerEngagement).toBeNull();
});

test("참여가 0이면 참여율은 0이고 참여 단가만 없다", () => {
  const m = adUnitMetrics(input({ engagements: 0 }));

  expect(m.engagementRate).toBe(0);
  expect(m.costPerEngagement).toBeNull();
});

test("지출이 없어도 노출이 있으면 CPM은 0이다", () => {
  // 아직 청구되지 않은 구간이다. null로 두면 "계산할 수 없다"로 읽혀 노출된 사실이 가려진다.
  const m = adUnitMetrics(input({ spend: 0 }));

  expect(m.cpm).toBe(0);
  expect(m.cpc).toBe(0);
});
