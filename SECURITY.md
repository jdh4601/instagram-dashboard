# Security Policy

## Supported versions

Security fixes are applied to the latest commit on `main`. This project does not currently
maintain security patches for older tags or forks.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability involving authentication, stored API keys,
Instagram access tokens, request forgery, or unintended data exposure.

Use GitHub's **Security → Report a vulnerability** flow for this repository. Include:

- the affected route or file;
- reproduction steps with fake credentials and fictional account data;
- the expected impact;
- a suggested mitigation, if known.

Do not include live Instagram tokens, LLM keys, email addresses, or real account screenshots.

## Deployment model

Instagram Dashboard is designed as a local-first, single-user application.

- `data/settings.json` contains credentials and is restricted to the file owner on supported
  operating systems.
- Set both `DASHBOARD_USER` and `DASHBOARD_PASSWORD` before exposing the app outside a trusted
  network.
- JSON storage is not intended for multi-tenant or horizontally scaled deployments.
- Run `npm run doctor` after installation and before exposing a deployment.

---

## 한국어

인증, API 키, Instagram 토큰, 요청 위조, 데이터 노출 관련 취약점은 공개 이슈로 올리지
말고 GitHub 저장소의 **Security → Report a vulnerability** 기능으로 제보해 주세요.
실제 토큰·이메일·계정 스크린샷은 첨부하지 마세요.

이 프로젝트는 로컬 우선 단일 사용자 앱입니다. 외부에 공개하기 전
`DASHBOARD_USER`와 `DASHBOARD_PASSWORD`를 모두 설정하고 `npm run doctor`를 실행하세요.
