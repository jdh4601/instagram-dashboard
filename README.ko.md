<!-- 언어: **한국어** · [English](./README.md) -->

# 릴스 분석 AI 대시보드

> **한국어** · [English](./README.md)

창업가 인터뷰 릴스 계정을 위한 **로컬 AI 분석 대시보드**. Instagram Graph API 지표를 바탕으로
릴스 퍼널(3초 훅 → CTA → 팔로우)의 **병목을 진단**하고 **내 컨텐츠에 맞는 해결책**까지
도출한다. 매일 아침 **베스트/워스트 릴스와 LLM 총평을 이메일로 받아볼 수도 있다.**

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
| 📈 조회수 추이 | 릴스별 조회수·도달을 동기화할 때마다 누적해 시계열로 표시(재시청·팔로우·프로필 방문 변화 포함) |
| 👥 팔로워 그래프 | 날짜별 팔로워 수 추이 + 직전 대비 증감 배지 |
| ✨ AI 맞춤 생성 | 진단·자막 기반으로 훅 3안·엔딩 3안·구간별 처방·콘텐츠 코멘트를 LLM이 생성 |
| 📝 자막 심층 분석 | 자막(SRT) + 성과 지표를 LLM에 보내 잘된 점/아쉬운 점의 원인을 도출해 릴스에 캐시 |
| 📧 일일 리포트 | 최근 1달 베스트/워스트 릴스 + 팔로워·도달 요약 + LLM 총평을 매일 아침 이메일로 발송(Resend) |

## 기술 스택

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Recharts 3 · Zod 4 ·
lucide-react · Jest 30 · `@anthropic-ai/sdk`(Claude `claude-opus-4-8`) · `openai`(OpenAI 호환 제공자) ·
`resend`(이메일 발송)

## 빠른 시작 (데모 데이터로 바로 둘러보기)

Instagram 토큰 없이도 가상 계정 데이터로 대시보드를 먼저 체험할 수 있다.

```bash
npm install
npm run seed:demo   # examples/demo-data → data/ 로 복사(가상의 예시 계정)
npm run dev
```

<http://localhost:3000> 을 열면 릴스·진단·팔로워 그래프가 채워진 상태로 뜬다.
실제 계정을 연결하려면 아래 **설정**과 [Instagram 연동 가이드](./docs/INSTAGRAM_SETUP.md)를 따른다.

> `seed:demo`는 `data/`가 비어 있을 때만 시딩한다. 이미 실제 데이터가 있으면
> `npm run seed:demo -- --force`로만 덮어쓸 수 있다.

## ⚠️ 보안 주의 (꼭 읽어주세요)

이 앱에는 **로그인/인증이 없다.** 접근할 수 있는 사람은 누구나 설정을 바꾸고(Instagram
토큰·LLM 키 저장), 유료 LLM 호출을 트리거할 수 있다. `dev`/`start`는 편의를 위해
`0.0.0.0`(같은 LAN에서 접근 가능)에 바인딩된다.

- **로컬 또는 신뢰할 수 있는 LAN에서만** 사용하세요.
- 인터넷에 노출해야 한다면 **반드시 앞단에 인증(리버스 프록시 Basic Auth 등)을 두세요.**
  인증 없이 VPS/공용 IP에 그대로 띄우면 토큰 유출·비용 폭탄 위험이 있습니다.
- `data/`(토큰·키·수집 데이터)와 `.env`는 gitignore 되어 있으니 커밋하지 마세요.

## LLM 제공자 설정

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

   또는 실제 계정을 [연동](./docs/INSTAGRAM_SETUP.md)한 뒤 대시보드의 **동기화** 버튼으로
   Graph API에서 자동 수집한다.

2. **자막(SRT) 첨부** — CapCut 오토캡션에서 내보낸 `.srt`를 릴스 상세 화면에 첨부해
   훅과 CTA를 성과 지표와 함께 분석한다. LLM 심층 분석을 실행하면 잘된 점/아쉬운 점의
   원인이 릴스에 캐시된다.

3. **분석 확인** — 대시보드에서 릴스를 선택하면 병목·진단·파생 지표·해결책이 즉시 표시된다.

4. **팔로워 추이** — 상단 폼에 날짜·팔로워 수를 입력하면 성장 그래프가 그려진다.

## 인사이트 데이터 출처

| 출처 | 자동 수집 데이터 | 표시 위치 |
|---|---|---|
| 파생 지표 | 도달 기반 참여율, 저장·공유 의도율, 도달당 재생, 재시청률, 평균 시청 비율, 프로필 방문·팔로우 전환 퍼널 | 릴스 상세 및 계정 인사이트 |
| Instagram Graph API | 계정의 팔로워·최근 7일 도달/조회/참여, 릴스의 조회·도달·반응·시청시간·재시청·프로필 활동·팔로우 중 계정에서 지원되는 항목 | 계정 데이터는 메인 상단, 릴스 데이터는 상세 화면 |

Graph API 지표는 API 버전과 계정 유형에 따라 달라질 수 있다. 선택 지표가 지원되지 않아도
기본 동기화는 계속되며, 실제 값 `0`과 미지원/미수집 상태는 구분해서 표시한다. 평균 시청시간을
영상 길이로 나눈 값은 실제 완주율이 아니므로 **평균 시청 비율**로 표시한다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET / POST | `/api/reels` | 릴스 목록 조회 / 등록(파생 지표 자동 계산) |
| GET | `/api/reels/[id]` | 릴스 단건 조회 |
| POST / DELETE | `/api/reels/[id]/transcript` | 릴스에 자막(SRT) 첨부 / 삭제 |
| POST | `/api/reels/[id]/transcript/analyze` | 자막 + 지표 → LLM 심층 분석(잘된 점/아쉬운 점 원인) |
| POST | `/api/recommend` | 릴스 ID → 진단 + 급락 + 룰 기반 처방 |
| POST | `/api/generate` | 릴스 ID → LLM 맞춤 생성(훅/엔딩/구간/코멘트) |
| GET / POST | `/api/snapshots` | 팔로워 스냅샷 조회 / 추가 |
| GET | `/api/profile` | 계정 프로필 조회 |
| GET / POST | `/api/settings` | LLM 제공자 + Instagram 토큰 설정 조회(마스킹) / 저장 |
| POST | `/api/sync` | Instagram Graph API에서 릴스·팔로워 자동 수집(병합) |
| POST | `/api/cron/daily-report` | 동기화 → 리포트 생성 → 이메일 발송(`x-cron-secret` 헤더 필요) |

## 일일 이메일 리포트

매일 아침 계정을 동기화하고 **최근 1달 베스트/워스트 릴스 3개씩 + 팔로워·도달 요약 + LLM 총평**을
이메일로 발송한다. 스케줄러(launchd 등)가 `CRON_SECRET`을 `x-cron-secret` 헤더에 담아
`/api/cron/daily-report`를 호출하면 된다. 설정은 `.env.example`와
[`scripts/launchd/README.md`](./scripts/launchd/README.md) 참고:

- `CRON_SECRET` — 크론 엔드포인트 보호용 시크릿(`openssl rand -hex 32`)
- `RESEND_API_KEY` · `REPORT_EMAIL_FROM` · `REPORT_EMAIL_TO` — [Resend](https://resend.com) 발송 설정
- `REPORT_URL` — 스케줄러가 호출할 리포트 엔드포인트(기본값 사용 시 생략 가능)

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
components/      # UI 컴포넌트 (Recharts 차트 + components/ui 디자인 시스템)
config/         # benchmarks.ts — 진단 임계값 단일 출처
examples/       # demo-data — 가상 예시 계정 시드 데이터(seed:demo)
lib/
  schemas/      # Zod 데이터 모델
  parsing/      # SRT 파서
  analysis/     # 지표·진단·급락 탐지·베이스라인·팔로워 추이 (순수함수)
  recommend/    # 룰 기반 처방 플레이북 + LLM 자막 인사이트
  report/       # 일일 리포트 빌더·LLM 총평 프롬프트·HTML 렌더·오케스트레이션
  email/        # Resend 이메일 발송
  store/        # JSON 파일 리포지토리 (릴스·계정·프로필·릴스 히스토리)
  llm/          # 제공자 추상화 (Anthropic/OpenAI 호환 텍스트 모델)
  graph/        # Instagram Graph API 클라이언트·매퍼·동기화
  settings/     # LLM 키·Instagram 토큰 설정 저장소(마스킹)
  ui/           # 포맷·차트 헬퍼(순수함수)
scripts/        # 데모 시드·일일 리포트 스케줄러(launchd)
docs/           # Instagram 연동 가이드 + 설계 문서
```

## 로드맵

- **Phase 1 (완료)** — SRT 기반 진단·해결책·시각화
- **Phase 2 (완료)** — Instagram Graph API 연동(릴스 집계 지표·팔로워 수 자동 수집)
- **Phase 3 (완료)** — LLM 맞춤 생성(훅/엔딩 3안, 구간별 처방, 콘텐츠 코멘트) — 제공자 선택 가능
- **Phase 4 (완료)** — 자막 LLM 심층 분석 + 매일 아침 베스트/워스트 + LLM 총평 이메일 리포트

## 라이선스

[MIT](./LICENSE) © 2026 DongHyun Jung
