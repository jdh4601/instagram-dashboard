import { renderToStaticMarkup } from "react-dom/server";
import { AdUnitDetail } from "@/components/AdUnitDetail";
import type { AdUnit } from "@/lib/ads/adUnit";
import type { Reel } from "@/lib/schemas";

function unit(over: Partial<AdUnit> = {}): AdUnit {
  return {
    adId: "120253915877380651",
    name: 'Post: "Ep 4. 매주 하나 만들고, 한 명에게 보여주기"',
    status: "ACTIVE",
    createdAt: "2026-08-30T10:21:23+0900",
    thumbnailUrl: "https://cdninstagram.example/reel-frame.jpg",
    spend: 3427,
    impressions: 698,
    reach: 600,
    clicks: 85,
    goal: "THRUPLAY",
    results: { count: 305, type: "THRUPLAY" },
    costPerResult: 11.23,
    budget: { amount: 4129, kind: "LIFETIME" },
    startTime: "2026-08-30T10:21:48+0900",
    endTime: "2026-08-31T10:21:48+0900",
    activity: [
      { key: "video_view", label: "3초 동영상 재생", value: 305 },
      { key: "link_click", label: "링크 클릭", value: 85 },
      { key: "some_future_action", label: null, value: 7 },
    ],
    engagements: 48,
    hasDelivery: true,
    ...over,
  };
}

function post(): Reel {
  return {
    id: "18159331198493386",
    mediaType: "REELS",
    postedAt: "2026-08-30T00:00:00Z",
    durationSec: 30,
    views: 2519,
    reach: 2000,
    likes: 100,
    comments: 4,
    saves: 30,
    shares: 20,
    avgWatchTimeSec: 10,
    caption: "Ep 4. 매주 하나 만들고, 한 명에게 보여주기",
  };
}

test("성과와 상세와 활동을 함께 보여 준다", () => {
  const html = renderToStaticMarkup(<AdUnitDetail unit={unit()} post={null} />);

  expect(html).toContain("305"); // 결과
  expect(html).toContain("698"); // 조회
  expect(html).toContain("600"); // 조회자
  expect(html).toContain("동영상 조회"); // 목표
  expect(html).toContain("3초 동영상 재생"); // 활동
});

// 모르는 행동을 감추면 Business Suite에는 있는 막대가 여기서만 사라진다.
test("이름을 모르는 활동도 원문 키로 그대로 그린다", () => {
  const html = renderToStaticMarkup(<AdUnitDetail unit={unit()} post={null} />);

  expect(html).toContain("some_future_action");
});

test("이어진 게시물이 있으면 원본 성과와 그중 광고분을 나란히 둔다", () => {
  const html = renderToStaticMarkup(<AdUnitDetail unit={unit()} post={post()} />);

  expect(html).toContain("원본 콘텐츠 성과");
  expect(html).toContain("2,519"); // 게시물 전체 조회
  expect(html).toContain("698"); // 그중 광고로 얻은 조회
  expect(html).toContain("/reel/18159331198493386");
});

test("게시물을 못 이었으면 원본 성과 자리를 비우고 이유를 적는다", () => {
  const html = renderToStaticMarkup(<AdUnitDetail unit={unit()} post={null} />);

  expect(html).toContain("이 광고와 이을 수 있는 게시물을 찾지 못했습니다");
});

test("아직 안 도는 광고는 성과 자리를 비우고 상태만 알린다", () => {
  const html = renderToStaticMarkup(
    <AdUnitDetail
      unit={unit({
        status: "PENDING_REVIEW",
        hasDelivery: false,
        spend: 0,
        impressions: 0,
        reach: 0,
        results: null,
        costPerResult: null,
        activity: [],
        engagements: null,
      })}
      post={null}
    />,
  );

  expect(html).toContain("심사 중");
  expect(html).toContain("아직 집행 성과가 없습니다");
});

test("참여를 모르면 0이 아니라 빈 칸으로 둔다", () => {
  const html = renderToStaticMarkup(
    <AdUnitDetail unit={unit({ engagements: null })} post={post()} />,
  );

  expect(html).not.toContain("참여 0");
});

// 목록에서만 보이고 상세에서 사라지면 어느 광고를 열었는지 다시 확인할 수 없다.
test("상세에도 어느 릴스인지 알 수 있게 썸네일을 둔다", () => {
  const html = renderToStaticMarkup(<AdUnitDetail unit={unit()} post={post()} />);

  expect(html).toContain("https://cdninstagram.example/reel-frame.jpg");
});

test("효율 지표를 성과 옆에 함께 놓는다", () => {
  const html = renderToStaticMarkup(<AdUnitDetail unit={unit()} post={null} />);

  expect(html).toContain("효율");
  expect(html).toContain("4,910원"); // CPM = 3427/698*1000
  expect(html).toContain("40원"); // 클릭당 비용 = 3427/85
  expect(html).toContain("12.18%"); // 클릭률 = 85/698
  expect(html).toContain("1.2회"); // 빈도 = 698/600
  expect(html).toContain("8.00%"); // 참여율 = 48/600
  expect(html).toContain("71원"); // 참여당 비용 = 3427/48
});

// 성과 카드가 이미 "아직 집행 성과가 없습니다"를 말한다. 빈 칸만 여섯 개 더 쌓으면
// 화면이 길어지기만 하고 말하는 것은 없다.
test("아직 안 도는 광고에는 효율 카드를 아예 그리지 않는다", () => {
  const html = renderToStaticMarkup(
    <AdUnitDetail
      unit={unit({
        status: "PENDING_REVIEW",
        hasDelivery: false,
        spend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        results: null,
        costPerResult: null,
        activity: [],
        engagements: null,
      })}
      post={null}
    />,
  );

  expect(html).not.toContain("효율");
});

test("참여를 모르면 참여율과 참여 단가만 빈 칸으로 둔다", () => {
  const html = renderToStaticMarkup(
    <AdUnitDetail unit={unit({ engagements: null })} post={null} />,
  );

  expect(html).toContain("4,910원"); // CPM은 그대로 나온다
  expect(html).not.toContain("8.00%"); // 참여율은 계산할 수 없다
});
