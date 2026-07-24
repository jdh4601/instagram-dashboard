# 캐러셀 지원 + 삭제 게시물 정리 — 설계 문서

- 작성일: 2026-07-24
- 작성자: Jayden + Claude
- 상태: 설계 합의 완료 (구현 계획 대기)

## 1. 목적 (Why)

현재 대시보드는 릴스만 다룬다. 두 가지 문제를 해결한다.

1. **캐러셀이 보이지 않는다.** 계정이 릴스 외에 캐러셀(여러 장 사진) 게시물도
   올리는데, 수집 단계에서 잘려나가 성과를 전혀 확인할 수 없다.
2. **삭제·아카이브한 게시물이 계속 남는다.** 동기화는 `upsert`만 하고 삭제를
   하지 않아, 인스타그램에서 지우거나 보관함으로 옮긴 게시물이
   `data/reels.json`에 영구히 남아 목록과 집계를 오염시킨다.

## 2. 현재 코드의 원인 지점

| 문제 | 위치 | 원인 |
|---|---|---|
| 캐러셀 누락 | `lib/graph/client.ts` `listReels()` | `media_product_type === "REELS"`만 통과시킴 |
| 타입 구분 불가 | `lib/schemas/index.ts` `ReelSchema` | 미디어 타입 필드 자체가 없음 |
| 유령 게시물 | `lib/graph/sync.ts` `syncFromGraph()` | API 목록에 없는 저장 레코드를 지우지 않음 |
| 기준선 오염 위험 | `app/api/reels/[id]/route.ts` | 베이스라인·이전/다음 이동에 전체 목록을 그대로 넘김 |

## 3. 확정된 결정 사항 (사용자 확정)

1. **토글 범위 = 목록 + 참여 지표만.** 릴스 전용 지표 위젯(평균 시청시간,
   3초 잔존율 추이)은 토글과 무관하게 항상 릴스 기준으로 계산한다.
2. **삭제 처리 = 완전 삭제.** 소프트 삭제 플래그를 두지 않고 `reels.json`과
   `reel-history.json`에서 레코드를 제거한다.
3. **캐러셀 상세 = 공통 지표만.** 측정 가능한 지표만 보여주고 그 지표로만
   진단·처방을 돌린다. 영상 전용 카드는 숨긴다.

## 4. 데이터 모델

`ReelSchema`에 필드 하나를 추가한다.

```ts
mediaType: z.enum(["REELS", "CAROUSEL"]).optional()  // 없으면 REELS
```

`.optional()`로 두는 이유:

- 기존 `data/reels.json` 21건에 이 필드가 없다. 필수로 만들면 파싱이 깨진다.
- 테스트 픽스처 수십 곳이 `Reel` 객체 리터럴을 만든다. `z.default()`를 쓰면
  출력 타입이 필수가 되어 이번 작업과 무관한 파일이 대량 수정된다.

읽기는 헬퍼 하나로 통일한다.

```ts
// lib/ui/mediaKind.ts (또는 lib/analysis 하위)
export type MediaKind = "REELS" | "CAROUSEL";
export function mediaKindOf(reel: Reel): MediaKind {
  return reel.mediaType ?? "REELS";
}
```

**타입 이름은 `Reel`을 유지한다.** 도메인상 `Post`가 맞지만 이름 변경은 약 50개
파일을 건드리며 이번 목표와 무관하다. UI 문구만 "릴스 목록" → "게시물 목록"으로
바꾼다.

## 5. 수집 계층 (`lib/graph/`)

### 5.1 미디어 목록

`listReels()` → `listMedia()`로 바꾸고 분류한다.

- `media_product_type === "REELS"` → `REELS`
- `media_type === "CAROUSEL_ALBUM"` → `CAROUSEL`
- 그 외(단일 사진·단일 영상 피드 글, 스토리) → 제외

페이지네이션 상한(`MAX_MEDIA_PAGES = 20`)과 커서 반복 감지는 그대로 둔다.

### 5.2 인사이트 지표를 타입별로 분리

캐러셀에는 `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`,
`reels_skip_rate`, `clips_replays_count`,
`ig_reels_aggregated_all_plays_count`가 존재하지 않는다. 지금 코드로 요청하면
`optionalInsights`의 폴백 경로를 타면서 게시물마다 지표를 하나씩 개별 재요청한다
(캐러셀 1건당 9회의 불필요한 Graph 호출).

| | 필수 | 선택 |
|---|---|---|
| REELS | 현행 `REQUIRED_REEL_METRICS` 유지 | 현행 `OPTIONAL_REEL_METRICS` 유지 |
| CAROUSEL | `reach, likes, comments, saved, shares` | `views, total_interactions, follows, profile_visits, profile_activity` |

`getInsights(mediaId, kind)`로 시그니처를 확장하고, 지원 지표 캐시
(`reelOptionalCapabilities`)도 타입별로 분리해 보관한다.

### 5.3 매핑

`mapMediaToReel`은 `mediaType`을 채워 넣는다. 캐러셀은 `avgWatchTimeSec = 0`,
`durationSec = 0`이 되고 `skipRate`·`hookRetention3s`·`replays`·`totalPlays`는
`undefined`로 남는다. 이는 기존 스키마 그대로 표현 가능하다.

## 6. 삭제·아카이브 정리 (`lib/graph/sync.ts`)

미디어 목록을 끝까지 받아낸 뒤, 목록에 없는 저장 게시물을 제거한다.
`listMedia()`는 실패 시 예외를 던지므로 배열이 반환됐다는 것은 전체 크롤 완주를
의미한다. 인스타그램 API는 삭제와 아카이브를 구분해서 알려주지 않으며, 둘 다
`me/media` 응답에서 사라지므로 동일하게 처리한다.

- 새 메서드
  - `ReelRepository.removeMany(ids: string[]): Promise<number>`
  - `ReelHistoryRepository.removeByReelIds(ids: string[]): Promise<number>`
  - 둘 다 기존 `withFileLock` + `writeJsonAtomic` 경로를 그대로 쓴다.
- **안전장치: 목록이 0건이면 prune을 건너뛴다.** 토큰 권한 문제로 빈 배열이
  돌아오는 경우가 있는데, 그때 전체가 삭제되면 수동 입력한 자막과 캐시된 LLM
  분석까지 복구 불가능하게 사라진다.
- `SyncResult`에 `removedReels: number` 추가 → 대시보드 토스트에
  "삭제된 게시물 N개 정리" 표기.

prune은 릴스 동기화 루프가 끝난 뒤, 계정 스냅샷 저장 전에 수행한다.

## 7. 토글 UI

`릴스 | 캐러셀 | 전체` 3상태 세그먼트 컨트롤. 기본값은 **릴스**로 현재 동작을
유지한다. 마크업은 `ReelList`의 기존 정렬 버튼 그룹 패턴을 그대로 따른다.

상태는 `app/page.tsx`가 보유하고 아래 위젯에 전달한다.

| 위젯 | 토글 반응 | 비고 |
|---|---|---|
| `ReelList` | O | 제목을 "게시물 목록"으로 |
| `EngagementPieChart` | O | 좋아요·저장·공유·댓글 구성은 미디어 공통 |
| `AccountOverview` | O | 게시물 수, 평균 인게이지먼트 |
| `DashboardMetrics` | X | 평균 시청시간·3초 잔존율은 릴스 전용. 헤더에 "릴스 기준" 명시 |

필터링은 순수 함수로 분리한다.

```ts
// lib/ui/mediaFilter.ts
export type MediaFilter = "REELS" | "CAROUSEL" | "ALL";
export function filterByMedia(reels: Reel[], filter: MediaFilter): Reel[];
```

## 8. 캐러셀 상세 페이지

`/reel/[id]` 라우트를 두 타입이 공유한다. 캐러셀일 때:

**숨김**
- `ReelPerformanceDashboard`의 평균 시청·총 시청시간·Skip Rate·재시청 카드
  (평균 시청은 현재 무조건 렌더되므로 `mediaType` 조건을 추가해야 한다)
- `SrtUploadCard` (자막 업로드·심층 분석)
- `AiGenerationPanel` (훅·엔딩 스크립트 생성 — 영상 전제)

**유지**
- 조회·도달·좋아요·댓글·저장·공유, 프로필 방문, 팔로우
- `ReelMetricTrend` (조회수·도달 추이 — 미디어 공통)
- 진단·병목 배너·처방

**진단 로직은 수정이 거의 필요 없다.** `diagnose()`가 값이 `undefined`인 지표를
이미 건너뛰므로, 캐러셀에서는 `hookRetention3s`와 `completionRate`가 자동
제외되고 공유율·저장율·좋아요율·댓글율·팔로우 전환율만 판정된다.

**반드시 고쳐야 하는 곳**: `app/api/reels/[id]/route.ts`가 개인화 베이스라인
(`buildBaselineThresholds`)과 이전/다음 이동(`adjacentReelIds`)에 전체 목록을
넘긴다. 같은 `mediaType`끼리만 비교·이동하도록 필터링한다. 그러지 않으면 캐러셀
기준선이 릴스 중앙값으로 오염되고, 목록에서 릴스만 보다가 상세에서 "다음"을
누르면 캐러셀로 튄다.

## 9. 작업 순서

두 단계로 분리하고 각각 커밋한다.

**A. 삭제 정리** — 스키마 변경이 없어 독립적이다. 먼저 끝내면 유령 게시물 문제가
즉시 해소된다.

**B. 캐러셀 수집 + 토글 + 상세 분기**

## 10. 테스트 계획 (TDD)

각 단계에서 실패하는 테스트를 먼저 쓴다.

**A단계**
- API 목록에 없는 저장 릴스가 `reels.json`에서 제거된다
- 해당 릴스의 `reel-history.json` 레코드도 함께 제거된다
- 목록이 0건이면 아무것도 삭제하지 않는다 (안전장치)
- `SyncResult.removedReels`가 실제 삭제 건수를 담는다

**B단계**
- `listMedia()`가 `CAROUSEL_ALBUM`을 포함하고 단일 사진 글은 제외한다
- 캐러셀에는 릴스 전용 지표를 요청하지 않는다
- `mediaType`이 없는 기존 JSON이 그대로 파싱되고 `REELS`로 읽힌다
- `filterByMedia`가 세 가지 필터에서 올바른 부분집합을 돌려준다
- 상세 라우트가 같은 `mediaType`만 베이스라인·이전/다음에 넘긴다
- 캐러셀 진단에 `hookRetention3s`·`completionRate` 판정이 들어가지 않는다

기존 테스트(`__tests__/`)는 모두 통과해야 한다. 검증 명령은
`npx jest --passWithNoTests`와 `npx tsc --noEmit`.

## 11. 명시적 비목표 (YAGNI)

- 단일 사진·단일 영상 피드 게시물 지원 (요청 범위 밖)
- 캐러셀 전용 벤치마크 임계값 세트 (근거 없는 숫자를 만들지 않는다)
- `Reel` → `Post` 타입 이름 변경
- 삭제된 게시물을 다시 볼 수 있는 보기 토글
- 캐러셀 슬라이드별(자식 미디어) 지표
