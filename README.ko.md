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

```bash
npm install
npm run seed:demo   # 가상 예시 계정 데이터를 data/ 에 로드
npm run dev
```

<http://localhost:3000> 을 열면 릴스·진단·팔로워 그래프가 채워진 상태로 뜬다.

## 실제 계정 연결

**프로페셔널(비즈니스/크리에이터) Instagram 계정**과 장기 Graph API 액세스 토큰이 필요하다.
전체 절차: [docs/INSTAGRAM_SETUP.md](./docs/INSTAGRAM_SETUP.md).

1. Meta 개발자 앱을 만들고 필요한 Instagram 권한으로 토큰을 발급한다.
2. 대시보드 **⚙️ 설정**(`/settings`)에 등록한다 — 로컬 `data/settings.json`에만 저장된다.
3. **동기화**를 눌러 릴스와 팔로워 데이터를 가져온다.

## ⚠️ 보안 주의

이 앱에는 **로그인/인증이 없다.** 접근할 수 있는 사람은 누구나 저장된 토큰·LLM 키를
읽고 바꿀 수 있으며, 유료 LLM 호출을 트리거할 수 있다.

- **로컬 또는 신뢰할 수 있는 LAN에서만** 사용하세요.
- 인터넷에 노출해야 한다면 **반드시 앞단에 인증(리버스 프록시 Basic Auth 등)을 두세요.**
  인증 없이 공용 IP에 그대로 띄우지 마세요.

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
npm test            # Jest 단위 테스트
npm run typecheck   # tsc --noEmit
npm run build       # 프로덕션 빌드
```

일일 이메일 리포트(cron/launchd) 설정은
[`scripts/launchd/README.md`](./scripts/launchd/README.md)에 정리돼 있다.

## 라이선스

[MIT](./LICENSE) © 2026 DongHyun Jung
