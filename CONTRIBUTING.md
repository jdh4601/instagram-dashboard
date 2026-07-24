# Contributing

> [한국어 안내는 아래에 있습니다 ↓](#한국어)

Thanks for contributing! This is a local-first Next.js app; the analysis engine
(`lib/analysis/*`) is pure functions covered by Jest tests.

## Setup

```bash
npm install
npm run seed:demo   # optional: fill the dashboard with fictional demo data
npm run dev
```

## Before opening a PR

```bash
npm test            # Jest
npm run typecheck   # tsc --noEmit
```

CI runs the same two commands on every PR to `main`, so please make sure they pass locally first.

## Guidelines

- Keep PRs small and focused; describe the *why* in the PR body.
- Add or update tests for behavior changes — the deterministic core (`lib/analysis`) is expected
  to stay fully covered.
- Never commit `data/` or `.env*` files (gitignored). Sample data belongs in
  `examples/demo-data/`.
- Docs and comments are welcome in Korean or English.

---

## 한국어

기여 감사합니다! 이 프로젝트는 로컬 우선 Next.js 앱이며, 분석 엔진(`lib/analysis/*`)은 순수
함수 + Jest 테스트로 이뤄져 있습니다.

### 준비

```bash
npm install
npm run seed:demo   # 선택: 가상 데모 데이터로 대시보드 채우기
npm run dev
```

### PR 올리기 전

```bash
npm test            # Jest
npm run typecheck   # tsc --noEmit
```

`main` 대상 PR마다 CI가 같은 두 명령을 실행하니, 로컬에서 먼저 통과를 확인해 주세요.

### 규칙

- PR은 작게, 주제별로 나눠 주세요. 본문에는 *왜* 바꾸는지 적어 주세요.
- 동작 변경에는 테스트를 추가·수정해 주세요. 특히 결정론적 코어(`lib/analysis`)는 테스트
  커버리지를 유지하는 게 원칙입니다.
- `data/`, `.env*` 파일은 절대 커밋하지 마세요(gitignore 처리됨). 예시 데이터는
  `examples/demo-data/`를 이용합니다.
- 문서·주석은 한국어/영어 모두 환영합니다.
