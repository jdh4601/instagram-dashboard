<!-- 언어: **한국어** · [English](./README.md) -->

# Instagram Dashboard

> **한국어** · [English](./README.md)

**Instagram 릴스 계정을 위한 로컬 AI 대시보드.** Instagram Graph API 지표를 바탕으로 릴스
퍼널(3초 훅 → CTA → 팔로우)의 **병목을 진단**하고 **해결책을 제안**한다. 매일 아침
**베스트/워스트 릴스와 LLM 총평을 이메일로 받아볼 수도 있다.**

![가상 데모 데이터가 채워진 릴스 분석 대시보드](./docs/screenshots/dashboard.png)

## 주요 기능

- **진단** — 7개 지표(훅·완료율·공유율·저장율·좋아요율·댓글율·팔로우 전환율)를
  강점/약점/병목으로 분류. 룰 기반이라 결과가 항상 재현 가능(LLM 미사용)
- **AI 맞춤 생성** — 진단·자막 기반으로 훅/엔딩 후보와 구간별 처방을 생성
- **추이 그래프** — 조회수·도달·팔로워 성장 추이
- **일일 이메일 리포트** — 베스트/워스트 릴스 + LLM 총평을 매일 아침 발송(선택)
- **LLM 제공자 선택 가능** — Anthropic(Claude) / OpenAI / Kimi(Moonshot) / Gemini

## 빠른 시작 (데모 데이터, Instagram 계정 불필요)

Node.js 22.16 이상이 필요하다.

```bash
npm install
npm run seed:demo   # 가상 예시 계정 데이터를 data/ 에 로드
npm run doctor      # 저장소·인증·ffprobe·선택 연동 점검
npm run dev
```

<http://localhost:3000> 을 열면 릴스·진단·팔로워 그래프가 채워진 상태로 뜬다.

실제 계정 동기화에서는 릴스 길이를 읽기 위해 `ffmpeg`에 포함된 `ffprobe`가 필요하다.
Docker 이미지에는 이미 포함되어 있으며, 로컬에 없더라도 동기화는 계속되지만 길이 기반
지표가 비어 있을 수 있다.

업그레이드나 대규모 동기화 전에는 비밀정보를 제외한 로컬 백업을 만들 수 있다.

```bash
npm run data:backup
```

백업은 `backups/` 아래에 생성되며 `data/settings.json`은 의도적으로 제외한다.
JSON과 실행 중인 SQLite 데이터베이스를 모두 안전하게 백업한다.

## 저장소 어댑터

기존과 같은 JSON이 무설정 기본값이다. `.env`에서 필요에 맞게 선택한다.

```bash
STORAGE_ADAPTER=json       # 로컬 파일, 하위 호환 기본값
STORAGE_ADAPTER=sqlite     # 로컬 단일 프로세스/서버
STORAGE_ADAPTER=postgres   # 공유 저장소, DATABASE_URL 필수
```

기존 JSON 분석 데이터를 SQLite로 옮기려면:

```bash
npm run data:backup
npm run storage:migrate:sqlite
# 이후 STORAGE_ADAPTER=sqlite 설정
```

SQLite는 영속 디스크가 필요하므로 ephemeral/serverless 배포에는 맞지 않는다. 앱 인스턴스가
여러 개거나 로컬 디스크가 유지되지 않는 플랫폼에서는 PostgreSQL을 쓰고 Instagram 토큰은
플랫폼 secret인 `INSTAGRAM_ACCESS_TOKEN`으로 주입한다. 로컬/단일 호스트에서는 자격증명이
소유자 전용 `data/settings.json`에 분리되며 분석 데이터 백업에는 포함되지 않는다.

## 실제 계정 연결

**프로페셔널(비즈니스/크리에이터) Instagram 계정**이 필요하다.
전체 절차: [docs/INSTAGRAM_SETUP.md](./docs/INSTAGRAM_SETUP.md).

1. Meta 개발자 앱을 만들고 필요한 Instagram 권한을 설정한다.
2. `INSTAGRAM_*` OAuth 환경변수 3개를 설정하고 **⚙️ 설정**에서 연결하거나, 장기 토큰을
   직접 붙여넣는다.
3. **동기화**를 눌러 릴스와 팔로워 데이터를 가져온다.

## ⚠️ 보안 주의

이 앱은 선택적 **HTTP Basic Auth**를 지원한다. `DASHBOARD_USER`와
`DASHBOARD_PASSWORD`를 설정하지 않으면 접근할 수 있는 누구나 저장된 토큰·LLM 키를
바꾸거나 유료 LLM 호출을 트리거할 수 있다.

- **로컬 또는 신뢰할 수 있는 LAN에서만** 사용하세요.
- 인터넷에 노출해야 한다면 [`.env.example`](./.env.example)의 두 Basic Auth 변수를
  모두 설정하거나 앞단에 더 강한 인증을 두세요. 인증 없이 공용 IP에 그대로 띄우지 마세요.

## LLM 제공자 설정

대시보드 **⚙️ 설정**(`/settings`)에서 API 키와 모델을 입력한다. 키는 로컬
`data/settings.json`에만 저장되며(gitignore), 화면에는 마스킹되어 표시된다.

| 제공자 | 기본 모델 |
|---|---|
| Anthropic (Claude) | `claude-opus-4-8` |
| OpenAI | `gpt-4o` |
| Kimi (Moonshot) | `moonshot-v1-8k-vision-preview` |
| Google Gemini | `gemini-2.0-flash` |

## 개발

```bash
npm test            # Vitest 단위 테스트
npm run typecheck   # tsc --noEmit
npm run build       # 프로덕션 빌드
```

일일 이메일 리포트(cron/launchd) 설정은
[`scripts/launchd/README.md`](./scripts/launchd/README.md)에 정리돼 있다.
저장소 개인정보 점검 결과와 소유자 승인 후 이력 재작성 절차는
[`docs/OPEN_SOURCE_AUDIT.md`](./docs/OPEN_SOURCE_AUDIT.md)에 정리돼 있다.

## 라이선스

[MIT](./LICENSE) © 2026 DongHyun Jung · [보안 정책](./SECURITY.md)
