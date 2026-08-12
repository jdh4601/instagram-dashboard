# 대시보드 정리 · 릴스 분석 레이아웃 · 훅 카탈로그

작성일: 2026-08-11
상태: 명세 확정 (구현 전)

## Before (원문)

> [3초 잔존율 그래프 스크린샷] 3초 잔존율 그래프에서 위아래 스크롤이 왜 생기니? 이거 없애줘. 불편해.
> ← 좌우로 스크롤해 전체 릴스 보기 → 이런 텍스트도 없애줘.
> 팔로워 스냅샷 추가 이것도 아예 없애줘. 게시물 전체보기 버튼도 필요없어. 이미 왼쪽 탭에 있기 때문에.
>
> [릴스 분석 페이지 스크린샷] 릴스 분석 페이지에서 왼쪽의 영상이랑 오른쪽의 분석 기능의 UI가 상하 높이가
> 안맞아서 보기 불편해. 오른쪽 Summary 부분을 제거하고, 분석 버튼을 위로 좀 더 올린 뒤, 분석 안에 있는
> transcript, idea analysis, hook, 이런 버튼이 있는 네비게이션바를 조금 더 위로 올려서 릴스랑 높이를 맞춰줘.
>
> http://localhost:3000/hooks 훅 페이지에서 훅 관련 템플릿과 원리를 정리해줘. 어떤 스토리텔링 템플릿이
> 있는지도. 타입별로 내가 확인할 수 있게, 그리고 복사해서 가져올 수 있게.
>
> [매체 토글 스크린샷] 대시보드 화면에 있는 이 toggle은 없애줘. 인게이지먼트 구성은 릴스와 캐러셀 모두
> 합한 지표를 보여줘야 해.

## After (확정 명세)

### A. 3초 잔존율 차트 스크롤

**목표**: 세로 스크롤바를 없앤다. 가로 스크롤은 유지하되 안내 문구는 뺀다.

- `components/DashboardMetrics.tsx:81` `ScrollableChartFrame`
  - `seriesLength > 8`일 때 뜨는 `← 좌우로 스크롤해 전체 릴스 보기 →` 문구(96행) 삭제.
  - 세로 스크롤 제거: `overflow-x-auto`는 CSS 규칙상 `overflow-y`를 `auto`로 만든다.
    Recharts 툴팁이 컨테이너 밖으로 뻗으면서 세로 스크롤바가 생기는 것으로 보인다 —
    `overflow-y-hidden`을 명시해 막는다. **구현 시 실제 원인 확인 후 적용.**
  - 가로 스크롤 캔버스(`chartCanvasMinWidth`)와 `role="region"` / `tabIndex` / `aria-label`은 유지.
    aria-label의 "좌우로 스크롤해 모든 릴스를 확인할 수 있습니다" 문구는 시각 문구와 달리 남긴다
    (스크린리더에겐 여전히 유효한 안내).
- 같은 프레임을 쓰는 시청 시간 차트(`WatchTimeCompletionChart`)에도 동일하게 적용된다.

**제외**: 릴스 개수 제한, 차트 압축.

### B. 대시보드 요소 제거

**목표**: 좌측 탭과 중복되거나 안 쓰는 UI를 걷어낸다.

- `app/page.tsx:266-273` — `게시물 N개 전체 보기` 링크 블록 삭제 (좌측 탭에 이미 있음).
- `app/page.tsx:275-` — `팔로워 스냅샷 추가` 폼 전체 삭제.
  - **폼 UI만 제거.** 스냅샷 데이터·`/api/snapshots`·`PerformanceChartsCard`의 팔로워
    증감/추이 차트는 그대로 둔다. 스냅샷은 동기화로 쌓인다.
  - 폼과만 엮인 state(`snapDate` 등)와 `addSnapshot` 핸들러는 함께 정리.
- `app/page.tsx:251` — `MediaTypeToggle` 삭제, `mediaFilter` state 제거.
  - 대시보드 범위를 **전체(릴스+캐러셀) 고정**으로 바꾼다.
  - `visibleReels = filterByMedia(reels, mediaFilter)` → 전체 릴스 사용.
  - 영향 범위(모두 합산 기준으로 바뀜): `AccountOverview`의 7일 도달·조회·참여 계정·
    총 상호작용·팔로우 전환율, `AccountFunnelCard`, `AudienceMixCard`, 인게이지먼트 구성.
  - `MediaTypeToggle` 컴포넌트와 `lib/ui/mediaFilter.ts`는 다른 사용처 확인 후 정리 여부 결정.

### C. 릴스 분석 패널 높이 정렬

**목표**: 오른쪽 분석 패널의 탭바 상단을 왼쪽 영상 상단에 맞춘다.

- `components/ReelAnalysisPanel.tsx:74-119`
  - Summary 블록(80-85행) **화면에서 완전 제거**. `analysis.summary`는 계속 생성되지만
    어디에도 표시하지 않는다.
  - `분석하기` 버튼(`AnalyzePrompt`)을 **탭바와 같은 줄 오른쪽**으로 옮긴다.
    탭 목록은 왼쪽, 버튼은 오른쪽 끝. 탭바가 가로 스크롤되므로 버튼은 `shrink-0`으로 고정.
  - 결과적으로 패널 최상단 = 탭바 = 영상 상단과 같은 y좌표.
- 좁은 화면(모바일, `lg` 미만)에서는 한 줄에 탭 4개 + 버튼이 안 들어간다 —
  줄바꿈 또는 버튼 축약으로 처리하고 터치 타깃 44px(`min-h-11`)은 유지.

### D. 훅 페이지 카탈로그

**목표**: `/hooks`에서 훅 유형별 원리와 스토리텔링 포맷 템플릿을 확인하고 통째로 복사한다.

**배치**: 기존 훅 보관함(`HookLibrary`) **아래에 새 섹션**으로 추가. 접었다 펼치는 구조.

**내용 1 — 훅 유형 카탈로그 (7종)**
- 기준 체계: `lib/schemas/reelAnalysis.ts:30` `HOOK_TYPES` — problem, contrarian,
  personal-experience, curiosity, result-proof, how-to, other.
  (보관함의 5종 `HOOK_CATEGORIES`는 건드리지 않는다. 카탈로그만 7종.)
- 유형마다: 라벨 / 원리 설명 / 언제 쓰는가 / 템플릿 문장 / 예시.
- 출처: `~/Documents/10_릴스분석/Short-Form Storytelling Principles.pdf`
- 기존 자산 활용: 이미 분석된 릴스의 `reelAnalysis.hook`(line·template·why)을 유형별로 묶어
  "내 릴스에서 나온 사례"로 붙인다.

**내용 2 — 8가지 스크립트 원리**
- 기준: `lib/schemas/reelAnalysis.ts:91` `PRINCIPLE_IDS` / `PRINCIPLE_LABELS` (8종 이미 존재).
  호기심과 대비 · 가치까지의 속도 · 가치 밀도 · 명료성 · 흡수율 · 기대감 · 감정 공명 · 리듬과 완급.
- 현재는 라벨만 있고 설명이 없다 → Principles PDF 본문을 근거로 원리별
  **정의 / 왜 작동하는가 / 실행 방법 / 나쁜 예 vs 좋은 예**를 채운다.
- `lib/recommend/reelAnalysis.ts:28-36`에 있는 한 줄 요약은 그대로 재사용하고 확장한다.

**내용 3 — 스토리텔링 포맷 10종**
- 기준: `lib/analysis/storyFormats.ts` `STORY_FORMATS` (이미 한국어로 존재).
  히어로즈 저니 · 개인적 깨달음 · 어바웃 미 · 비포 애프터 · 목표·꿈 여정 · 챌린지 ·
  성취 발표 · 브이로그 · 근황 공유 · 타인에게 배운 것.
- 포맷마다: 설명 / secretSauce / 비트 시퀀스(라벨 · purpose · optional 여부) / 비트별 템플릿 문장.
- **새 데이터를 만들지 않는다.** 기존 상수를 화면에 노출하는 것이 원칙.

**복사**: **포맷/유형 전체 묶음 단위**로 복사.
- 훅 유형 1개 → 원리 + 템플릿 전체를 마크다운으로 클립보드에.
- 스토리텔링 포맷 1개 → 비트 시퀀스 + 템플릿 전체를 마크다운으로 클립보드에.
- 문장 낱개 복사 버튼은 넣지 않는다.

**제외**: 카탈로그 항목을 클릭해 훅 보관함에 저장하는 기능(POST /api/hooks) — 이번 범위 밖.

### E. 기준 날짜 라벨 정리 · 동기화 시점 이동

**목표**: 카드마다 흩어진 `... 기준` / `계정 전체` 라벨을 걷어내고, 신선도 정보는 동기화 버튼 옆 한 곳에 모은다.

제거 대상:
- `components/AudienceMixCard.tsx:28` — `<Badge>{mix.date} 기준</Badge>`
- `components/AudienceMixCard.tsx:36` — `note="표시된 게시물 기준"`
- `components/AudienceMixCard.tsx:51` — `note="계정 전체 기준"`
- `components/AccountFunnelCard.tsx:48-52` — 제목 아래 `{dateLabel} 기준` 보조 줄
- `components/AccountFunnelCard.tsx:56` — `<Badge>계정 전체</Badge>`

`SectionLabel`의 `note` prop이 전부 비게 되면 prop 자체를 정리한다.

추가:
- `components/DashboardActions.tsx` — 동기화 버튼 **바로 왼쪽**에 상대 시간 표기.
  예: `3시간 전 동기화`, `방금 동기화`, `2일 전 동기화`.
- 동기화 시각을 저장하는 필드가 현재 없다 → **새로 만든다.**
  - 동기화 성공 시각(ISO)을 저장. 저장 위치는 `lib/settings/store.ts` 또는 전용 필드 —
    구현 시 기존 저장소 구조에 맞춰 결정.
  - 동기화 라우트가 성공했을 때만 갱신한다. 실패한 동기화가 시각을 밀면 거짓 신선도가 된다.
  - 상대 시간 포맷 함수는 순수 함수로 분리하고 기준 시각을 주입받게 해 테스트를 고정한다
    (`components/UploadRhythmCard.tsx:16`의 기존 패턴과 동일).
- 값이 아직 없을 때(한 번도 동기화 안 함)는 아무것도 표시하지 않는다.

## 결정 표

| 쟁점 | 결정 |
|------|------|
| 3초 잔존율 가로 스크롤 | 유지. 세로 스크롤바와 안내 문구만 제거 |
| 릴스 분석 Summary | 화면에서 완전 제거 (데이터는 계속 생성) |
| 분석하기 버튼 위치 | 탭바와 같은 줄 오른쪽 |
| 훅 카탈로그 배치 | 보관함 아래 섹션 |
| 복사 단위 | 포맷/유형 전체 묶음 (마크다운) |
| 팔로워 스냅샷 | 폼만 제거, 데이터·차트 유지 |
| 훅 유형 체계 | AI 분석 7종으로 통일 (보관함 5종은 그대로) |
| 원리 내용 출처 | Short-Form Storytelling Principles / Template Database PDF |
| 매체 토글 제거 후 범위 | 전체(릴스+캐러셀) 고정 |
| 동기화 시점 표기 | 상대 시간(`3시간 전 동기화`), 동기화 버튼 왼쪽. 시각 저장 필드 신설 |

## 완료 기준

- [ ] 3초 잔존율·시청 시간 차트에 세로 스크롤바가 없고, 가로 스크롤은 동작한다
- [ ] 대시보드에 매체 토글·전체 보기 링크·스냅샷 폼이 없다
- [ ] 대시보드 KPI·퍼널·인게이지먼트 구성이 릴스+캐러셀 합산으로 계산된다
- [ ] 릴스 상세에서 탭바 상단과 영상 상단의 y좌표가 같고, 분석하기 버튼이 탭바 오른쪽에 있다
- [ ] `/hooks`에서 훅 7유형 · 8원리 · 포맷 10종을 확인하고 각각 통째로 복사할 수 있다
- [ ] 카드에 `... 기준` / `계정 전체` 라벨이 없고, 동기화 버튼 왼쪽에 상대 시간이 뜬다
- [ ] `npx tsc --noEmit` 통과, 기존 테스트 통과
  (`__tests__/performanceChartsCard.test.tsx:77`이 "팔로워 스냅샷"을 기대하므로 확인 필요)
