# 릴스 분석 AI 대시보드

창업가 인터뷰 릴스 계정을 위한 **로컬 AI 분석 대시보드**. Instagram Graph API 지표를 바탕으로
릴스 퍼널(3초 훅 → CTA → 팔로우)의 **병목을 진단**하고 **내 컨텐츠에 맞는 해결책**까지
도출한다.

- **진단은 결정론(룰 기반·테스트 가능), 창의적 생성만 LLM** — 분석 결과가 항상 재현 가능.
- 지표의 목적에 따라 `views` 또는 `reach`를 분모로 사용하고 계산식을 화면에 표시.
- 데이터는 로컬 JSON 파일에 저장(`data/`, gitignore).
- **LLM 제공자 선택 가능** — Anthropic(Claude) / OpenAI / Kimi(Moonshot) / Gemini 중 골라서 사용.
  키는 대시보드 설정 화면에서 추가.

## 주요 기능

| 기능 | 설명 |
|---|---|
| 🩺 진단 | 7개 지표(3초 훅·완료율·공유율·저장율·좋아요율·댓글율·팔로우 전환율)를 강점/약점/병목으로 분류 |
| ⚡ 병목 배너 | 가중치×갭이 가장 큰 약점 1개를 "이번 병목"으로 강조 + 지난 3개 평균 대비 델타 |
| 💡 해결책 | 약점→처방 룰 플레이북(콜드 오픈·공유 유발·엔딩 CTA 등) |
| 📈 성장 추이 | 릴스별 3초 훅 시계열 + 개인화 베이스라인(릴스 5개 이상 시 계정 롤링 중앙값으로 전환) |
| 👥 팔로워 그래프 | 날짜별 팔로워 수 추이 + 직전 대비 증감 배지 |
| ✨ AI 맞춤 생성 | 진단·자막 기반으로 훅 3안·엔딩 3안·구간별 처방·콘텐츠 코멘트를 LLM이 생성 |

## 기술 스택

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · Recharts · Zod · Jest · `@anthropic-ai/sdk` (Claude `claude-opus-4-8`)

## 시작하기

### 1. 설치

```bash
npm install
```

### 2. 실행

```bash
npm run dev
```

- PC: <http://localhost:3000>

### 3. LLM 제공자 설정

대시보드 우측 상단 **⚙️ 설정**(`/settings`)에서 사용할 제공자의 API 키와 모델을 입력하고
활성 제공자를 선택한다. 키는 이 PC의 `data/settings.json`에만 저장되며(gitignore),
화면에는 마스킹되어 표시된다.

| 제공자 | 기본 모델 | 연결 |
|---|---|---|
| Anthropic (Claude) | `claude-opus-4-8` | 네이티브 |
| OpenAI | `gpt-4o` | OpenAI 호환 |
| Kimi (Moonshot) | `moonshot-v1-8k-vision-preview` | OpenAI 호환 |
| Google Gemini | `gemini-2.0-flash` | OpenAI 호환 |

> env `ANTHROPIC_API_KEY`는 설정에 키가 없을 때만 쓰이는 폴백이다.

## 사용 방법

1. **릴스 등록** — 집계 지표(조회수·좋아요·댓글·저장·공유·평균 시청시간 등)를 JSON으로 등록.

   ```bash
   curl -X POST localhost:3000/api/reels \
     -H 'Content-Type: application/json' \
     -d @__tests__/fixtures/sample-reel.json
   ```

2. **자막(SRT) 첨부** — CapCut 오토캡션에서 내보낸 `.srt`를 릴스 상세 화면에 첨부해
   훅과 CTA를 성과 지표와 함께 분석한다.

3. **분석 확인** — 대시보드에서 릴스를 선택하면 병목·진단·파생 지표·해결책이 즉시 표시된다.

4. **팔로워 추이** — 상단 폼에 날짜·팔로워 수를 입력하면 성장 그래프가 그려진다.

## 인사이트 데이터 출처

| 출처 | 자동 수집 데이터 | 표시 위치 |
|---|---|---|
| 파생 지표 | 도달 기반 참여율, 저장·공유 의도율, 도달당 재생, 재시청률, 평균 시청 비율, 프로필 방문·팔로우 전환 퍼널 | 릴스 상세 및 계정 인사이트 |
| Instagram Graph API | 계정의 팔로워·최근 7일 도달/조회/참여, 릴스의 조회·도달·반응·시청시간·Skip Rate·재시청·프로필 활동·팔로우 중 계정에서 지원되는 항목 | 계정 데이터는 메인 상단, 릴스 데이터는 상세 화면 |

Graph API 지표는 API 버전과 계정 유형에 따라 달라질 수 있다. 선택 지표가 지원되지 않아도
기본 동기화는 계속되며, 실제 값 `0`과 미지원/미수집 상태는 구분해서 표시한다. 평균 시청시간을
영상 길이로 나눈 값은 실제 완주율이 아니므로 **평균 시청 비율**로 표시한다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET / POST | `/api/reels` | 릴스 목록 조회 / 등록(파생 지표 자동 계산) |
| POST | `/api/recommend` | 릴스 ID → 진단 + 급락 + 룰 기반 처방 |
| POST | `/api/generate` | 릴스 ID → LLM 맞춤 생성(훅/엔딩/구간/코멘트) |
| GET / POST | `/api/snapshots` | 팔로워 스냅샷 조회 / 추가 |
| GET / POST | `/api/settings` | LLM 제공자 + Instagram 토큰 설정 조회(마스킹) / 저장 |
| POST | `/api/sync` | Instagram Graph API에서 릴스·팔로워 자동 수집(병합) |

## 개발

```bash
npm test            # Jest 단위 테스트 (결정론 코어 100% 커버)
npm run typecheck   # tsc --noEmit
npm run build       # 프로덕션 빌드
```

분석 엔진(`lib/analysis/*`)은 전부 순수함수이며 TDD로 작성됐다. LLM 호출은
테스트에서 목킹하며 라이브 호출하지 않는다.

## 프로젝트 구조

```
app/            # 대시보드 페이지와 API 라우트
components/      # UI 컴포넌트 (Recharts 차트 포함)
config/         # benchmarks.ts — 진단 임계값 단일 출처
lib/
  schemas/      # Zod 데이터 모델
  parsing/      # SRT 파서
  analysis/     # 지표·진단·급락 탐지·베이스라인·팔로워 추이 (순수함수)
  recommend/    # 룰 기반 처방 플레이북
  store/        # JSON 파일 리포지토리
  llm/          # 제공자 추상화 (Anthropic/OpenAI 호환 텍스트 모델)
  graph/        # Instagram Graph API 클라이언트·매퍼·동기화
  settings/     # LLM 키·Instagram 토큰 설정 저장소(마스킹)
docs/superpowers/  # 설계 문서 + 구현 계획
```

## 로드맵

- **Phase 1 (완료)** — SRT 기반 진단·해결책·시각화
- **Phase 2 (완료)** — Instagram Graph API 연동(릴스 집계 지표·팔로워 수 자동 수집)
- **Phase 3 (완료)** — LLM 맞춤 생성(훅/엔딩 3안, 구간별 처방, 콘텐츠 코멘트) — 제공자 선택 가능
