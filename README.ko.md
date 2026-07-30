<!-- markdownlint-disable MD013 -->

# Instagram Dashboard

[![CI](https://github.com/jdh4601/instagram-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/jdh4601/instagram-dashboard/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js 22.16+](https://img.shields.io/badge/node-%3E%3D22.16-339933.svg)](./package.json)

> **한국어** · [English](./README.md)

Instagram 프로페셔널 계정을 위한 로컬 우선 셀프 호스팅 분석 대시보드다. 릴스와 캐러셀
지표를 동기화하고, 계정 전환 퍼널의 병목을 찾고, 자막과 성과 데이터를 실행 가능한 콘텐츠
개선안으로 바꿔 준다.

![가상 데모 데이터가 채워진 Instagram Dashboard](./docs/screenshots/dashboard.png)

## 왜 만들었나?

Instagram Insights는 수치를 보여 주지만 다음에 무엇을 바꿔야 하는지는 직접 해석해야 한다.
이 프로젝트는 재현 가능한 규칙 기반 분석과 선택적 LLM 기능을 결합한다.

- **계정 전환 퍼널** — 도달 → 프로필 방문 → 팔로우 또는 바이오 링크 클릭과 7일 변화
- **릴스·캐러셀 분석** — API가 지원하는 조회수, 도달, 반응, 저장, 공유, 시청 시간, 재생 지표
- **오디언스 구성** — 팔로워·비팔로워 도달 비교
- **규칙 기반 진단** — 같은 데이터에는 같은 강점·약점·병목 결과
- **자막 분석** — SRT 업로드 후 훅·엔딩·구간별 개선안 생성
- **Graph API 동기화** — 페이지네이션, 선택 지표 폴백, 이력 스냅샷, 삭제 게시물 정리
- **일일 이메일 리포트** — Resend를 통한 최근 성과 요약(선택)
- **LLM 직접 선택** — Anthropic, OpenAI, Kimi, Google Gemini

데모 계정과 스크린샷은 모두 가상 데이터다. Instagram 계정이나 유료 API 키 없이 전체
대시보드를 먼저 살펴볼 수 있다.

## 빠른 시작

### 요구 사항

- Node.js 22.16 이상
- npm 10 이상
- 실제 계정 동기화에서 릴스 길이를 자동 확인하려면 FFmpeg의 `ffprobe`

### 데모 데이터로 실행

```bash
git clone https://github.com/jdh4601/instagram-dashboard.git
cd instagram-dashboard
npm install
npm run seed:demo
npm run doctor
npm run dev
```

<http://localhost:3000>을 열면 가상 릴스, 계정 스냅샷, 진단이 채워진다.

데모에서는 `ffprobe`가 없어도 된다. macOS는 `brew install ffmpeg`, Ubuntu/Debian은
`sudo apt-get install ffmpeg`로 설치할 수 있다. Docker 이미지에는 이미 포함되어 있다.

## 실제 Instagram 계정 연결

Instagram **비즈니스 또는 크리에이터** 계정과 Instagram API with Instagram Login을 설정한
Meta 개발자 앱이 필요하다. 앱이 요청하는 권한은 다음과 같다.

- `instagram_business_basic`
- `instagram_business_manage_insights`

OAuth 연결이 권장 방식이다.

1. 예시 설정 파일을 복사한다.

   ```bash
   cp .env.example .env.local
   ```

2. `.env.local`에 다음 값을 입력한다.

   ```dotenv
   INSTAGRAM_APP_ID=Meta-앱-ID
   INSTAGRAM_APP_SECRET=Meta-앱-시크릿
   INSTAGRAM_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/instagram/callback
   ```

3. Meta 앱에도 같은 redirect URI를 등록하고 대시보드를 재시작한 뒤
   <http://localhost:3000/settings>를 연다.
4. **Instagram으로 연결**을 누르고, 대시보드로 돌아와 **동기화**를 누른다.

서버는 짧게 유지되는 OAuth state를 검증하고 authorization code를 교환한 뒤 장기 토큰만
소유자 전용 `data/settings.json`에 저장한다. 장기 토큰을 직접 붙여넣는 방식도 지원한다.
다중 인스턴스 배포에서는 파일 대신 `INSTAGRAM_ACCESS_TOKEN`으로 토큰을 주입한다.

Meta 앱 설정, 테스터 권한, 토큰 갱신, 오류 해결은
[Instagram 전체 설정 가이드](./docs/INSTAGRAM_SETUP.md)를 참고한다.

## LLM 설정

`/settings`의 **설정** 화면에서 제공자·모델을 선택하고 API 키를 입력한다. LLM은 선택 사항이며,
지표 수집과 규칙 기반 진단은 LLM 없이 동작한다.

| 제공자          | 기본 모델                       |
| --------------- | ------------------------------- |
| Anthropic       | `claude-opus-4-8`               |
| OpenAI          | `gpt-4o`                        |
| Kimi (Moonshot) | `moonshot-v1-8k-vision-preview` |
| Google Gemini   | `gemini-2.0-flash`              |

화면에서 입력한 키는 Git에서 제외된 `data/settings.json`에 저장된다. 지원 운영체제에서는 파일
소유자만 읽을 수 있고, API 응답에는 마스킹된 값만 노출된다.

## 저장소 선택

모든 분석 Repository가 같은 어댑터 계약을 사용하므로 JSON, SQLite, PostgreSQL 중 하나를
선택할 수 있다.

| 어댑터     | 적합한 환경                         | 설정                                        | 특징                               |
| ---------- | ----------------------------------- | ------------------------------------------- | ---------------------------------- |
| JSON       | 체험, 기존 로컬 설치                | `STORAGE_ADAPTER=json`                      | 별도 설정 없는 기본값              |
| SQLite     | 영속 디스크가 있는 단일 호스트      | `STORAGE_ADAPTER=sqlite`                    | 기본적으로 `DATA_DIR` 아래 DB 하나 |
| PostgreSQL | 여러 인스턴스 또는 비영속 앱 디스크 | `STORAGE_ADAPTER=postgres` + `DATABASE_URL` | 분석 데이터 공유                   |

기존 JSON 분석 데이터를 SQLite로 옮기려면:

```bash
npm run data:backup
npm run storage:migrate:sqlite
# STORAGE_ADAPTER=sqlite로 변경한 뒤 앱을 재시작한다.
```

마이그레이션은 이미 데이터가 있는 SQLite DB와의 병합을 기본적으로 거부한다. 의도적인 경우에만
`--merge`를 전달할 수 있다. SQLite는 영속 파일시스템이 필요하므로 ephemeral/serverless
디스크에는 적합하지 않다.

자격증명 설정은 분석 데이터 저장소와 의도적으로 분리되어 있다. 수평 확장 배포에서는 지원되는
런타임 자격증명(`INSTAGRAM_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`)을 호스팅 플랫폼의 secret
manager로 주입한다. 다른 LLM 제공자는 현재 각 인스턴스의 설정 파일이 필요하다.

## 데이터 백업

업그레이드나 대규모 동기화 전 비밀정보를 제외한 백업을 만든다.

```bash
npm run data:backup
```

백업은 `backups/` 아래에 생성된다. JSON 분석 데이터와 실행 중인 SQLite의 일관된 스냅샷을
포함하고, 자격증명이 있는 `settings.json`은 의도적으로 제외한다.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

<http://localhost:3000>을 연다. Compose는 `./data`를 `/app/data`에 마운트하므로 컨테이너를
교체해도 JSON, SQLite, 로컬 설정이 유지된다. PostgreSQL을 쓸 때는 `.env`에
`STORAGE_ADAPTER=postgres`와 `DATABASE_URL`을 설정한다.

프로덕션 이미지는 비루트 사용자로 실행되고 FFmpeg를 포함한다.

## 환경변수 요약

전체 설명은 [`.env.example`](./.env.example)에 있다.

| 목적                     | 환경변수                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| 저장소                   | `DATA_DIR`, `STORAGE_ADAPTER`, `SQLITE_DATABASE_PATH`, `DATABASE_URL`      |
| Instagram OAuth          | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_OAUTH_REDIRECT_URI` |
| Stateless Instagram 토큰 | `INSTAGRAM_ACCESS_TOKEN`                                                   |
| 대시보드 보호            | `DASHBOARD_USER`, `DASHBOARD_PASSWORD`                                     |
| LLM 폴백                 | `ANTHROPIC_API_KEY`                                                        |
| 일일 리포트              | `CRON_SECRET`, `RESEND_API_KEY`, `REPORT_EMAIL_FROM`, `REPORT_EMAIL_TO`    |

설정을 바꾼 뒤 `npm run doctor`를 실행한다. 비밀값을 출력하지 않으면서 Node 버전, 데이터
디렉터리 권한, 저장소 선택, 인증 설정 완결성, FFmpeg, 파일 권한, 선택 연동을 검사한다.

## 배포 보안

이 프로젝트는 로컬 우선 단일 운영자용 앱이며 Basic Auth는 기본적으로 꺼져 있다.

localhost나 신뢰 네트워크 밖에 공개하기 전:

- `DASHBOARD_USER`와 `DASHBOARD_PASSWORD`를 모두 설정한다.
- HTTPS를 사용한다.
- `.env*`와 `data/settings.json`을 소스 관리에 넣지 않는다.
- JSON/SQLite에는 영속 디스크를, 공유·비영속 배포에는 PostgreSQL을 사용한다.
- 일일 리포트 엔드포인트를 활성화하기 전에 `CRON_SECRET`을 설정한다.
- `npm run doctor`를 실행한다.

Basic Auth 변수 중 하나만 설정하면 앱은 `503`으로 닫힌다. 취약점 제보와 지원 배포 모델은
[보안 정책](./SECURITY.md)을 참고한다.

## 개발

```bash
npm run doctor
npm test
npm run typecheck
npm run build
```

CI에서는 프로덕션 의존성 감사, PostgreSQL 통합 테스트, Vitest, TypeScript 검사, Next.js
프로덕션 빌드를 실행한다.

```text
app/              Next.js 페이지와 API 라우트
components/       대시보드와 공용 UI 컴포넌트
lib/analysis/     결정론적 지표 계산과 진단
lib/graph/        Instagram Graph API 클라이언트와 동기화
lib/store/        JSON, SQLite, PostgreSQL 어댑터
lib/settings/     자격증명 설정과 마스킹
scripts/          Doctor, 백업, 마이그레이션, 리포트 도구
```

기여를 환영한다. Pull Request를 열기 전에 [CONTRIBUTING.md](./CONTRIBUTING.md)를 읽어 주세요.

## 추가 문서

- [Instagram 계정 설정](./docs/INSTAGRAM_SETUP.md)
- [일일 리포트와 launchd 설정](./scripts/launchd/README.md)
- [오픈소스 준비 및 Git 이력 감사](./docs/OPEN_SOURCE_AUDIT.md)
- [보안 정책](./SECURITY.md)

## 라이선스

[MIT](./LICENSE) © 2026 DongHyun Jung
