# AI 계정 진단 챗봇 패널 설계 — 2026-07-31

## 목적

대시보드 우측에 계정 진단 챗봇을 붙인다. 사용자가 자기 인스타그램 계정의 현황·장단점·병목을
자연어로 묻고 답을 받는다. 챗봇의 핵심 가치는 대화 능력이 아니라 **이 계정에 대한 풍부한 컨텍스트**다.
대시보드가 이미 계산해 둔 지표·퍼널·진단 결과를 그대로 프롬프트에 실어, 챗봇이 화면과 같은 자로
같은 결론을 말하게 한다.

LLM 제공자는 기존 API 제공자 4종에 더해 이 PC에 설치된 로컬 CLI(Claude Code / Codex / Gemini)를
고를 수 있다.

## 결정 사항 (브레인스토밍에서 확정)

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 실행 환경 | **로컬 전용 기능** | 로컬 CLI는 서버가 자식 프로세스를 띄워야 해서 Vercel에서 동작 불가. 챗봇 전체를 로컬 게이트 뒤에 둔다 |
| 컨텍스트 전략 | **컨텍스트 팩 + 필요시 확장** | 토큰 예측 가능, 모든 제공자·CLI에서 동일하게 동작. tool calling은 CLI 경로 난이도가 급증 |
| 패널 형태 | **접힐 수 있는 고정 사이드바** | xl 이상 우측 고정 열, 그 이하 드로어 |
| 대화 기록 | **단일 세션 영속 저장** | `data/chat.json`. 새로고침·재시작해도 진단 맥락 유지 |
| CLI 호출 | **고정 프리셋 + stdin** | 커맨드를 사용자가 자유 입력하면 설정 파일이 임의 코드 실행 통로가 된다 |

## 비목표 (Non-goals)

- 여러 대화 스레드 관리 (단일 세션만)
- tool calling / 에이전트형 자율 탐색
- 배포 환경(Vercel)에서의 챗봇 동작
- 기존 `TextModel` 경로(자막 분석·맞춤 대본 생성) 변경
- 마크다운 렌더링 라이브러리 도입

---

## 아키텍처

### 1. LLM 계층 — 스트리밍 채팅 계약

`TextModel.generate()`는 단발성 non-streaming이라 대화에 쓸 수 없다. 형제 계약을 추가한다.

```ts
// lib/llm/types.ts (추가)
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatModel {
  /** 델타 텍스트를 순서대로 흘린다. 소비자가 중단하면 generator를 닫아 정리한다. */
  stream(args: { system: string; turns: ChatTurn[] }): AsyncIterable<string>;
}
```

어댑터 3종:

| 파일 | 대상 | 구현 |
| --- | --- | --- |
| `lib/llm/chat/anthropic.ts` | anthropic | SDK `messages.stream` |
| `lib/llm/chat/openaiCompatible.ts` | openai / kimi / gemini | `chat.completions.create({ stream: true })` |
| `lib/llm/chat/localCli.ts` | claude-cli / codex-cli / gemini-cli | 자식 프로세스 stdout을 델타로 |

기존 텍스트 어댑터와 같이 테스트 주입용 클라이언트를 옵션으로 받는다.

해석기 `lib/llm/chat/index.ts`의 `getChatModel()`은 `settings.chatProvider`를 읽어 어댑터를 만든다.
`chatProvider`가 없으면 `textProvider`로 폴백한다(기존 `settings.json`과 호환).

### 2. 로컬 CLI 어댑터

프리셋 테이블은 코드 안 상수이며 사용자가 편집할 수 없다.

```ts
// lib/llm/cliProviders.ts
export type CliProviderId = "claude-cli" | "codex-cli" | "gemini-cli";

export const CLI_PRESETS: Record<CliProviderId, CliPreset> = {
  "claude-cli": {
    label: "Claude Code CLI",
    command: "claude",
    args: ["-p", "--output-format", "text"],
  },
  "codex-cli": {
    label: "Codex CLI",
    command: "codex",
    args: ["exec", "--sandbox", "read-only", "-"],
  },
  "gemini-cli": {
    label: "Gemini CLI",
    command: "gemini",
    args: ["-p"],
  },
};
```

호출 규약:

- `spawn(command, args, { shell: false })` — 셸을 거치지 않으므로 인자 주입 여지가 없다
- 프롬프트는 **stdin**으로 전달한다. argv 길이 제한과 따옴표 처리 문제를 모두 피한다
- system 프롬프트는 stdin 본문 맨 앞에 합친다. 세 CLI의 system 플래그 형태가 제각각이라 통일한다
- 타임아웃 120초. 초과하면 `SIGTERM` → 2초 후 `SIGKILL`
- stdout은 UTF-8로 디코딩해 청크 단위로 그대로 델타로 흘린다
- 비정상 종료 시 stderr 앞 200자를 오류 메시지에 포함한다
- 소비자가 스트림을 중단하면 프로세스를 kill 한다

`lib/llm/chat/cliDetect.ts` — `execFile(command, ["--version"], { timeout: 3000 })` 성공 여부로
설치를 감지하고 프로세스 메모리에 캐시한다. 설정 화면이 이 결과를 쓴다.

### 3. 로컬 게이트

```ts
// lib/runtime/config.ts (추가)
isLocalRuntime: boolean; // = env.VERCEL 가 없음
```

- `/api/chat`의 모든 메서드는 로컬이 아니면 404를 반환한다
- `/api/settings` 응답에 `chat: { available: boolean, ... }`을 실어 대시보드가 패널을 숨긴다
- 설정 화면의 챗봇 섹션은 안내 문구로 대체된다

### 4. 컨텍스트 팩 — `lib/chat/context.ts`

새 분석 로직을 만들지 않는다. 기존 함수의 결과를 모아 텍스트로 렌더링만 한다.

포함 내용:

1. 프로필 — username, 팔로워 수, 게시물 수, 최근 팔로워 증감 (`buildAccountOverview`, `latestFollowerDelta`)
2. 계정 퍼널 — 도달→프로필 방문→팔로우/링크클릭 + 강약 판정 (`buildAccountFunnel`, `accountFunnelVerdicts`)
3. 도달 구성 — 팔로워 / 비팔로워 (`buildAudienceMix`)
4. 릴스 종합 지표 (`computeDashboardMetrics`)
5. 최근 진단 — 강점 / 약점 / 병목 (`diagnoseRecent`)
6. 최근 20개 게시물 요약 테이블 — 날짜, 캡션 40자, 조회, 도달, 참여율, 3초 잔존, 저장/공유율, 팔로우
7. **판정 임계값 표** (`config/benchmarks`) — 챗봇이 대시보드와 같은 기준으로 강약을 말하게 하는 핵심

인터페이스:

```ts
export function buildAccountContext(
  reels: Reel[],
  snapshots: AccountSnapshot[],
  profile: AccountProfile | null,
): AccountContext;

export function renderAccountContext(context: AccountContext): string;
```

데이터가 없는 항목은 "데이터 부족"으로 명시한다(`narrativePrompt`의 기존 규약과 동일). 목표 분량은
3~5k 토큰이며, 릴스 20개 상한이 이를 유지한다.

### 5. 필요시 확장 — `lib/chat/reelMention.ts`

사용자 메시지에서 특정 게시물을 지목했는지 결정적으로 판별한다.

- 릴스 ID 문자열이 그대로 들어 있으면 정확 일치로 채택
- 아니면 캡션 토큰과의 겹침 점수를 계산해 임계값 이상인 상위 항목을 채택
- 최대 2개까지만 확장한다

채택된 릴스는 전체 지표 + 자막(`transcript`) + `transcriptInsights`를 컨텍스트에 덧붙인다.

### 6. system 프롬프트 — `lib/chat/prompt.ts`

`buildChatPrompt(context, expandedReels)`가 역할 규정 + 컨텍스트 팩 + 답변 규약을 하나의 system
문자열로 조립한다. 답변 규약:

- 한국어, 마크다운 최소화(굵게·짧은 불릿까지만)
- 주어진 지표에 근거해서만 말하고, 데이터가 부족하면 부족하다고 밝힌다
- 진단할 때는 병목을 먼저 짚고 그 다음 실행 가능한 조치를 제안한다
- 임계값 표를 근거로 강약을 판정한다 — 대시보드 화면과 다른 결론을 내지 않는다

`narrativePrompt.ts`가 일일 리포트에서 쓰는 톤·규약과 일관되게 유지한다.

### 7. 저장 — `lib/chat/store.ts`

`settings.json`과 같은 방식(`withFileLock` + `writeJsonAtomic`)으로 `data/chat.json`에 저장한다.
`STORAGE_ADAPTER`가 sqlite/postgres여도 JSON 파일을 쓴다 — `settings` 저장소와 같은 선례를 따른다.

```ts
interface ChatMessageRecord {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  provider?: string; // 어떤 제공자가 답했는지 (배지 표시용)
}

interface ChatStore {
  get(): Promise<ChatMessageRecord[]>;
  append(messages: ChatMessageRecord[]): Promise<void>;
  clear(): Promise<void>;
}
```

디스크에는 최근 50턴만 보관한다. 모델에는 최근 12턴만 전달한다(컨텍스트 예산).

### 8. API — `app/api/chat/route.ts`

| 메서드 | 동작 |
| --- | --- |
| `GET` | 저장된 대화 + `{ available, provider, reason? }` |
| `POST` | 메시지 추가 후 NDJSON 스트림 응답 |
| `DELETE` | 대화 초기화 |

`POST`/`DELETE`는 `assertJsonRequest`로 CSRF 가드를 먼저 통과한다. 스트림 이벤트는 `/api/sync`와
동일한 패턴이라 클라이언트가 `readNdjson`을 그대로 재사용한다.

```
{"type":"delta","text":"..."}
{"type":"delta","text":"..."}
{"type":"done","message":{...}}
```

오류는 헤더가 이미 나간 뒤에도 전달돼야 하므로 `{"type":"error","error":"..."}`로 흘린다.

사용자가 중단하면 부분 응답은 저장하지 않는다.

---

## UI

### 레이아웃 (`app/page.tsx`)

```
xl 이상:  ┌ max-w-[110rem] ────────────────────┬──────────┐
          │ <main max-w-5xl> 대시보드 그대로     │ ChatPanel │  ← sticky, w-[26rem]
          └────────────────────────────────────┴──────────┘

xl 미만:  대시보드 전체 폭 + 우하단 FAB → 오버레이 드로어
```

대시보드 본문의 `max-w-5xl`은 유지한다. 기존 카드 레이아웃과 차트 비율이 그대로 남는다.
열림/닫힘 상태는 `localStorage("chat-open")`에 기억한다.

### 컴포넌트

| 파일 | 역할 |
| --- | --- |
| `components/chat/ChatPanel.tsx` | 껍데기 — 열림/닫힘, 헤더(제공자 배지, 대화 초기화) |
| `components/chat/useChat.ts` | 상태 + NDJSON 스트림 소비 + 중단(AbortController) |
| `components/chat/ChatMessages.tsx` | 메시지 리스트, 자동 스크롤, 스트리밍 커서 |
| `components/chat/ChatComposer.tsx` | textarea, Enter 전송 / Shift+Enter 줄바꿈, 중단 버튼 |
| `components/chat/ChatSuggestions.tsx` | 빈 상태 추천 질문 칩 |

로직을 `useChat`으로 분리하는 이유는 재사용이 아니라 파일 크기다. 한 파일에 두면 `ChatPanel`이
400줄에 근접한다.

추천 질문은 이 앱이 실제로 답할 수 있는 것으로 고정한다:

- "지금 내 계정의 병목은 어디야?"
- "최근 2주 성과를 진단해줘"
- "도달은 나오는데 팔로우가 안 붙는 이유는?"
- "다음 릴스는 뭘 만들어야 해?"

### 마크다운 처리

새 의존성을 추가하지 않는다. system 프롬프트가 평문 + 짧은 불릿을 요구하고,
`lib/chat/renderText.ts`(~40줄)가 `**굵게**`, `- 불릿`, 번호 목록만 안전한 React 노드로 변환한다.
HTML은 주입하지 않는다. 일일 리포트의 `narrativePrompt`가 이미 "마크다운 없이 평문" 규약을 쓰고
있어 일관된다.

### `app/page.tsx` 정리

현재 372줄이라 패널을 얹으면 파일 크기 한도에 걸린다. 손대는 김에 다음을 분리한다:

- 토스트 → `components/DashboardToast.tsx`
- 스켈레톤 → `components/DashboardSkeleton.tsx`

정리 후 약 250줄이 되고, 그 위에 레이아웃 래퍼와 `<ChatPanel />`을 얹는다. 그 외 리팩터링은 하지 않는다.

---

## 설정 화면 (`app/settings/page.tsx`)

"AI 진단 챗봇" 섹션을 추가한다.

```
○ Anthropic (Claude)   ● 키 등록됨
○ OpenAI
○ Kimi (Moonshot)
○ Google Gemini
─────────────────────────
○ Claude Code CLI      ● 감지됨 (claude)
○ Codex CLI            ● 감지됨 (codex)
○ Gemini CLI           ● 감지됨 (gemini)
   ↳ 로컬 CLI는 이 PC의 로그인 세션을 그대로 씁니다. API 키가 필요 없습니다.
```

- `settings.json`에 `chatProvider` 필드를 추가한다. 없으면 `textProvider`로 폴백하므로 기존
  저장 파일과 호환된다
- CLI 미설치면 해당 라디오를 비활성화하고 설치 안내를 보여준다
- 로컬 실행이 아니면 섹션 전체를 "로컬 실행에서만 사용할 수 있습니다" 안내로 대체한다

`lib/settings/store.ts`의 스키마·정규화·마스킹 경로에 `chatProvider`를 함께 반영한다.

---

## 오류 처리

| 상황 | 동작 |
| --- | --- |
| 제공자 미설정 | 입력창 비활성 + `/settings` 링크 |
| CLI 미설치인데 선택돼 있음 | 첫 요청에서 명확한 메시지 + 설정 링크 |
| CLI 타임아웃(120초) | `SIGTERM` → 2초 후 `SIGKILL`, 타임아웃 메시지 |
| CLI 비정상 종료 | stderr 앞 200자를 오류 메시지에 포함 |
| 사용자 중단 | AbortController → 스트림·프로세스 정리, 부분 응답 미저장 |
| API 키 오류 · 429 | 그대로 오류 말풍선으로 노출 (조용히 삼키지 않음) |

---

## 테스트

기존 `__tests__/` 평면 구조와 한국어 테스트명 규약을 따른다. 구현 전에 실패하는 테스트를 먼저 쓴다.

| 파일 | 검증 |
| --- | --- |
| `chatContext.test.ts` | 빈 데이터 / 정상 / 릴스 20개 상한 / 임계값 포함 |
| `chatReelMention.test.ts` | ID 정확 일치, 캡션 키워드 매칭, 무매치, 최대 2개 상한 |
| `chatStore.test.ts` | append·get·clear, 50턴 상한, 잠금 하 원자적 쓰기 |
| `chatModels.test.ts` | Anthropic/OpenAI는 주입 클라이언트로, CLI는 fake spawn으로 델타·타임아웃·비정상 종료 |
| `apiChat.test.ts` | guard 415/403, NDJSON 이벤트 순서, 로컬 게이트 404, DELETE 초기화 |
| `chatRenderText.test.ts` | 굵게·불릿·특수문자 이스케이프 |

CLI 어댑터 테스트는 실제 프로세스를 띄우지 않는다. 느려지고 비결정적이 된다. 실제 CLI 연결은
구현 후 개발 서버를 띄워 직접 확인한다.

---

## 파일 목록

**신규 (19)**

```
lib/llm/cliProviders.ts
lib/llm/chat/index.ts
lib/llm/chat/anthropic.ts
lib/llm/chat/openaiCompatible.ts
lib/llm/chat/localCli.ts
lib/llm/chat/cliDetect.ts
lib/chat/context.ts
lib/chat/reelMention.ts
lib/chat/store.ts
lib/chat/prompt.ts
lib/chat/renderText.ts
app/api/chat/route.ts
components/chat/ChatPanel.tsx
components/chat/useChat.ts
components/chat/ChatMessages.tsx
components/chat/ChatComposer.tsx
components/chat/ChatSuggestions.tsx
components/DashboardToast.tsx
components/DashboardSkeleton.tsx
```

**수정 (5)**

```
app/page.tsx           — 레이아웃 래퍼 + ChatPanel, 토스트·스켈레톤 분리
app/settings/page.tsx  — AI 진단 챗봇 섹션
lib/settings/store.ts  — chatProvider 필드
lib/runtime/config.ts  — isLocalRuntime
lib/llm/types.ts       — ChatTurn / ChatModel 계약
```

기존 `TextModel` 경로(자막 분석·맞춤 대본 생성)는 건드리지 않는다.
