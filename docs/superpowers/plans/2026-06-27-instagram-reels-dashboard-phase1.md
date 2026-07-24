# Instagram 릴스 AI 분석 대시보드 — Phase 1 (MVP) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EDIT 스크린샷 + SRT를 넣으면 결정론적 진단(강점/약점/병목) + 룰 기반 해결책 + 잔존 곡선/지표 시각화를 즉시 보여주는 로컬 Next.js 대시보드를 만든다 (Anthropic 키만 필요, Graph API 불필요).

**Architecture:** 수집(SRT 파서 + Claude Vision 스샷 파서) → 정규화 데이터 모델(Zod) → JSON 파일 스토어 → 결정론 분석 엔진(지표/진단/급락탐지/베이스라인, 전부 순수함수·TDD) → 룰 기반 추천 → Next.js App Router UI(Recharts). 진단은 결정론, 창의적 생성만 LLM이라는 분리 원칙을 따른다.

**Tech Stack:** Next.js 15 (App Router), TypeScript (strict), Tailwind CSS, Recharts, Zod, Jest + ts-jest, `@anthropic-ai/sdk` (Claude Vision: `claude-opus-4-8`).

## Global Constraints

- 모든 시크릿(`ANTHROPIC_API_KEY`)은 `.env.local`(gitignore)에 두고 **서버 라우트/서버 코드에서만** 호출. 클라이언트 노출 0. `.env.example`에 placeholder 제공.
- TypeScript `strict: true`. `any` 금지 (`unknown` + 타입가드). `@ts-ignore`/`@ts-expect-error`는 설명 주석 없이는 금지.
- 비율 분모는 항상 **views(조회수)**. 모든 파생 비율 = `metric / views * 100`.
- 진단 임계값은 `config/benchmarks.ts` 한 곳에서만 정의 (매직넘버 분산 금지).
- 분석 엔진(`lib/analysis/*`)은 순수함수 + 100% 단위테스트. LLM/Vision 호출만 목킹 — 테스트에서 라이브 API 호출 금지.
- 새 기능은 **실패 테스트 먼저** 작성(TDD). 같은 에러 2회 반복 시 중단하고 원인 설명.
- 기본 Claude 모델: `claude-opus-4-8`. adaptive thinking (`thinking: {type: "adaptive"}`).
- 커밋 메시지: Conventional Commits (`feat`/`fix`/`test`/`chore`/`docs`...). 한 논리 변경 = 한 커밋.
- 파일 크기 목표 200–400줄, 함수 <50줄, 중첩 ≤3단(가드절 사용).
- 데이터 모델·임계값의 **권위 출처는 스펙**: `docs/superpowers/specs/2026-06-27-instagram-reels-dashboard-design.md`.

---

## File Structure (Phase 1)

```
instagram-dashboard/
├── package.json, tsconfig.json, jest.config.ts, next.config.ts, tailwind/postcss config
├── .env.example
├── config/
│   └── benchmarks.ts                 # 임계값 + weight (단일 출처)
├── lib/
│   ├── schemas/index.ts              # Zod 스키마 + 추론 타입 (데이터 모델)
│   ├── parsing/
│   │   ├── srt.ts                    # SRT → TranscriptLine[] (순수)
│   │   └── screenshot.ts             # Claude Vision → 스샷 지표 (서버, 목킹)
│   ├── analysis/
│   │   ├── metrics.ts                # DerivedRates 계산 (순수)
│   │   ├── diagnosis.ts              # 밴드 판정 + 병목 랭킹 (순수)
│   │   ├── dropDetection.ts          # 잔존곡선 급락 구간 (순수)
│   │   └── baseline.ts               # 개인화 롤링 중앙값 (순수)
│   ├── recommend/
│   │   └── playbook.ts               # 약점 플래그 → 처방 (순수, 룰 기반)
│   └── store/
│       └── reelRepository.ts         # JSON 파일 스토어 (리포지토리 IF)
├── app/
│   ├── layout.tsx, globals.css
│   ├── page.tsx                      # 대시보드
│   ├── upload/page.tsx               # 모바일 LAN 업로드
│   └── api/
│       ├── reels/route.ts            # GET 목록 / POST upsert
│       ├── parse-screenshot/route.ts # POST 이미지 → Vision 파싱 결과
│       └── recommend/route.ts        # POST reelId → 진단+처방
├── components/
│   ├── BottleneckBanner.tsx  DiagnosisCards.tsx  MetricBars.tsx
│   ├── RetentionChart.tsx  GrowthTrend.tsx  SolutionsPanel.tsx
│   └── ReelPicker.tsx  IngestButtons.tsx
├── data/                             # JSON 스토어 (gitignore, 런타임 생성)
└── __tests__/ + __tests__/fixtures/
```

각 분석 파일은 단일 책임 순수함수 모듈. UI 컴포넌트는 1파일 1컴포넌트.

---

### Task 1: 프로젝트 스캐폴드 + 툴체인

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `jest.config.ts`, `jest.setup.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `.env.example`
- Modify: `.gitignore` (이미 존재: `node_modules/ .next/ data/ .env.local *.pem *.key .DS_Store`)

**Interfaces:**
- Consumes: 없음 (최초 태스크)
- Produces: 빌드 가능한 Next.js App Router 앱 + `npx jest` 동작 + `npx tsc --noEmit` 통과. `data/` 디렉터리는 런타임에 스토어가 생성.

- [ ] **Step 1: 의존성 설치**

```bash
cd <project-root>
npm init -y
npm install next@15 react@19 react-dom@19 recharts zod @anthropic-ai/sdk
npm install -D typescript @types/react @types/node @types/react-dom \
  jest ts-jest @types/jest jest-environment-jsdom \
  tailwindcss @tailwindcss/postcss postcss
```

- [ ] **Step 2: `tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: `next.config.ts` + `postcss.config.mjs` + `app/globals.css`**

`next.config.ts`:
```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

`postcss.config.mjs`:
```javascript
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

`app/globals.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 4: `app/layout.tsx` + `app/page.tsx` (플레이스홀더)**

`app/layout.tsx`:
```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "릴스 분석 대시보드" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
export default function Page() {
  return <main className="p-8">릴스 분석 대시보드 (Phase 1)</main>;
}
```

- [ ] **Step 5: Jest 설정 (`jest.config.ts`, `jest.setup.ts`)**

`jest.config.ts`:
```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};
export default config;
```

`jest.setup.ts`:
```typescript
// 전역 테스트 설정 (현재는 비어 있음, 향후 픽스처 헬퍼 등록용)
export {};
```

- [ ] **Step 6: `package.json` 스크립트 추가 + `.env.example`**

`package.json`의 `"scripts"`를 다음으로 교체:
```json
"scripts": {
  "dev": "next dev -H 0.0.0.0",
  "build": "next build",
  "start": "next start -H 0.0.0.0",
  "test": "jest",
  "typecheck": "tsc --noEmit"
}
```
> `dev`/`start`를 `-H 0.0.0.0`으로 바인딩해야 폰에서 `http://<맥 LAN IP>:3000/upload` 접속 가능 (스펙 8절).

`.env.example`:
```
# Anthropic API 키 (스크린샷 Vision 파싱용). 실제 값은 .env.local 에.
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 7: 스모크 테스트 — 빌드/타입체크/제스트 동작 확인**

`__tests__/smoke.test.ts`:
```typescript
test("toolchain smoke", () => {
  expect(1 + 1).toBe(2);
});
```

Run: `npx tsc --noEmit && npx jest`
Expected: tsc 에러 0건, jest 1 passing.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "chore: scaffold Next.js app router + jest + tailwind toolchain"
```

---

### Task 2: 데이터 모델 (Zod 스키마 + 타입)

**Files:**
- Create: `lib/schemas/index.ts`
- Test: `__tests__/schemas.test.ts`

**Interfaces:**
- Consumes: `zod`
- Produces:
  - `TranscriptLineSchema`, `ReelSchema`, `DerivedRatesSchema`, `ReachSourcesSchema`, `RetentionPointSchema`, `AccountSnapshotSchema`, `ScreenshotParseSchema`
  - 추론 타입: `TranscriptLine`, `Reel`, `DerivedRates`, `ReachSources`, `RetentionPoint`, `AccountSnapshot`, `ScreenshotParse`
  - `Reel` 필드(스펙 4절 그대로): `id, postedAt, durationSec, views, reach, likes, comments, saves, shares, avgWatchTimeSec` (필수); `hookRetention3s?, retentionCurve?, reachSources?, followsFromReel?, caption?, transcript?, derived?` (선택).

- [ ] **Step 1: 실패 테스트 작성**

`__tests__/schemas.test.ts`:
```typescript
import { ReelSchema, ScreenshotParseSchema } from "@/lib/schemas";

test("ReelSchema는 필수 집계 지표가 있는 최소 릴스를 통과시킨다", () => {
  const reel = {
    id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 53,
    views: 10000, reach: 9000, likes: 300, comments: 12,
    saves: 40, shares: 170, avgWatchTimeSec: 20,
  };
  expect(() => ReelSchema.parse(reel)).not.toThrow();
});

test("ReelSchema는 음수 views를 거부한다", () => {
  const bad = {
    id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 53,
    views: -1, reach: 9000, likes: 300, comments: 12,
    saves: 40, shares: 170, avgWatchTimeSec: 20,
  };
  expect(() => ReelSchema.parse(bad)).toThrow();
});

test("ScreenshotParseSchema는 잔존곡선 좌표와 3초훅을 검증한다", () => {
  const parsed = {
    hookRetention3s: 35.3,
    retentionCurve: [{ sec: 0, pct: 100 }, { sec: 3, pct: 35.3 }],
    reachSources: { reelsTab: 60, explore: 30, home: 10 },
  };
  expect(() => ScreenshotParseSchema.parse(parsed)).not.toThrow();
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest schemas`
Expected: FAIL — "Cannot find module '@/lib/schemas'".

- [ ] **Step 3: 스키마 구현**

`lib/schemas/index.ts`:
```typescript
import { z } from "zod";

export const TranscriptLineSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  text: z.string(),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

export const RetentionPointSchema = z.object({
  sec: z.number().nonnegative(),
  pct: z.number().min(0).max(100),
});
export type RetentionPoint = z.infer<typeof RetentionPointSchema>;

export const ReachSourcesSchema = z.object({
  reelsTab: z.number().min(0).max(100).optional(),
  explore: z.number().min(0).max(100).optional(),
  home: z.number().min(0).max(100).optional(),
  profile: z.number().min(0).max(100).optional(),
  other: z.number().min(0).max(100).optional(),
});
export type ReachSources = z.infer<typeof ReachSourcesSchema>;

export const DerivedRatesSchema = z.object({
  shareRate: z.number(),
  saveRate: z.number(),
  likeRate: z.number(),
  commentRate: z.number(),
  engagementRate: z.number(),
  completionRate: z.number(),
  followRate: z.number().optional(),
});
export type DerivedRates = z.infer<typeof DerivedRatesSchema>;

export const ReelSchema = z.object({
  id: z.string().min(1),
  postedAt: z.string(),
  durationSec: z.number().positive(),
  views: z.number().nonnegative(),
  reach: z.number().nonnegative(),
  likes: z.number().nonnegative(),
  comments: z.number().nonnegative(),
  saves: z.number().nonnegative(),
  shares: z.number().nonnegative(),
  avgWatchTimeSec: z.number().nonnegative(),
  hookRetention3s: z.number().min(0).max(100).optional(),
  retentionCurve: z.array(RetentionPointSchema).optional(),
  reachSources: ReachSourcesSchema.optional(),
  followsFromReel: z.number().nonnegative().optional(),
  caption: z.string().optional(),
  transcript: z.array(TranscriptLineSchema).optional(),
  derived: DerivedRatesSchema.optional(),
});
export type Reel = z.infer<typeof ReelSchema>;

export const AccountSnapshotSchema = z.object({
  date: z.string(),
  followerCount: z.number().nonnegative(),
  reachLast7d: z.number().nonnegative(),
});
export type AccountSnapshot = z.infer<typeof AccountSnapshotSchema>;

// Claude Vision 스크린샷 파싱 결과 (API가 못 주는 3개 지표)
export const ScreenshotParseSchema = z.object({
  hookRetention3s: z.number().min(0).max(100).optional(),
  retentionCurve: z.array(RetentionPointSchema).optional(),
  reachSources: ReachSourcesSchema.optional(),
});
export type ScreenshotParse = z.infer<typeof ScreenshotParseSchema>;
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest schemas && npx tsc --noEmit`
Expected: 3 passing, tsc 에러 0.

- [ ] **Step 5: 커밋**

```bash
git add lib/schemas/index.ts __tests__/schemas.test.ts
git commit -m "feat(schemas): add Zod data model for Reel and screenshot parse"
```

---

### Task 3: 벤치마크/임계값 설정 (단일 출처)

**Files:**
- Create: `config/benchmarks.ts`
- Test: `__tests__/benchmarks.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type MetricKey = "hookRetention3s" | "completionRate" | "shareRate" | "saveRate" | "likeRate" | "commentRate" | "followRate"`
  - `interface Threshold { weakBelow: number; strongAbove: number; weight: number; label: string }`
  - `const BENCHMARKS: Record<MetricKey, Threshold>` (스펙 5절 임계값 표 그대로)
  - `const DROP_THRESHOLD_PCT_PER_SEC = 8` (급락 기준), `const HOOK_WINDOW_SEC = 3`, `const BASELINE_MIN_REELS = 5`

- [ ] **Step 1: 실패 테스트 작성**

`__tests__/benchmarks.test.ts`:
```typescript
import { BENCHMARKS, DROP_THRESHOLD_PCT_PER_SEC, BASELINE_MIN_REELS } from "@/config/benchmarks";

test("3초 훅 임계값은 스펙(weak<45, strong>55, weight5)과 일치한다", () => {
  expect(BENCHMARKS.hookRetention3s.weakBelow).toBe(45);
  expect(BENCHMARKS.hookRetention3s.strongAbove).toBe(55);
  expect(BENCHMARKS.hookRetention3s.weight).toBe(5);
});

test("공유율 weight는 4다", () => {
  expect(BENCHMARKS.shareRate.weight).toBe(4);
});

test("급락 임계와 베이스라인 최소 릴스 수 상수", () => {
  expect(DROP_THRESHOLD_PCT_PER_SEC).toBe(8);
  expect(BASELINE_MIN_REELS).toBe(5);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest benchmarks`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현 (스펙 5절 표 전사)**

`config/benchmarks.ts`:
```typescript
export type MetricKey =
  | "hookRetention3s"
  | "completionRate"
  | "shareRate"
  | "saveRate"
  | "likeRate"
  | "commentRate"
  | "followRate";

export interface Threshold {
  weakBelow: number;   // 이 값 미만이면 🔴 약점
  strongAbove: number; // 이 값 초과면 🟢 강점
  weight: number;      // 병목 우선순위 가중치
  label: string;       // UI 표기 (한국어)
}

// 스펙 5절 임계값 표 — 여기가 유일한 출처. 튜닝은 이 파일에서만.
export const BENCHMARKS: Record<MetricKey, Threshold> = {
  hookRetention3s: { weakBelow: 45, strongAbove: 55, weight: 5, label: "3초 훅 잔존" },
  completionRate:  { weakBelow: 30, strongAbove: 50, weight: 3, label: "완료율" },
  shareRate:       { weakBelow: 0.4, strongAbove: 0.8, weight: 4, label: "공유율" },
  saveRate:        { weakBelow: 0.3, strongAbove: 0.6, weight: 3, label: "저장율" },
  likeRate:        { weakBelow: 1.5, strongAbove: 3, weight: 1, label: "좋아요율" },
  commentRate:     { weakBelow: 0.1, strongAbove: 0.3, weight: 2, label: "댓글율" },
  followRate:      { weakBelow: 0.4, strongAbove: 0.8, weight: 4, label: "팔로우 전환율" },
};

export const DROP_THRESHOLD_PCT_PER_SEC = 8; // 잔존곡선 급락 플래그 기준 (%p/초)
export const HOOK_WINDOW_SEC = 3;            // 0~3초 훅 이탈은 별도 보고
export const BASELINE_MIN_REELS = 5;         // 개인화 베이스라인 전환 최소 릴스 수
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest benchmarks`
Expected: 3 passing.

- [ ] **Step 5: 커밋**

```bash
git add config/benchmarks.ts __tests__/benchmarks.test.ts
git commit -m "feat(config): add diagnostic benchmark thresholds (single source)"
```

---

### Task 4: SRT 파서 (순수, TDD)

**Files:**
- Create: `lib/parsing/srt.ts`, `__tests__/fixtures/sample.srt`
- Test: `__tests__/srt.test.ts`

**Interfaces:**
- Consumes: `TranscriptLine` from `@/lib/schemas`
- Produces: `parseSrt(raw: string): TranscriptLine[]` — 표준 SRT를 `{ startSec, endSec, text }[]`로. `00:00:02,500` → `2.5`초. 빈 입력 → `[]`. 멀티라인 텍스트는 공백으로 join.

- [ ] **Step 1: 픽스처 작성**

`__tests__/fixtures/sample.srt`:
```
1
00:00:00,000 --> 00:00:02,500
연구개발에 실패해서

2
00:00:02,500 --> 00:00:06,000
모든 걸 잃었습니다
그리고 다시 시작했죠

3
00:00:08,000 --> 00:00:10,200
지금은 매출 10억을 만들었어요
```

- [ ] **Step 2: 실패 테스트 작성**

`__tests__/srt.test.ts`:
```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSrt } from "@/lib/parsing/srt";

const raw = readFileSync(join(__dirname, "fixtures/sample.srt"), "utf8");

test("SRT 타임코드를 초로 변환한다", () => {
  const lines = parseSrt(raw);
  expect(lines[0]).toEqual({ startSec: 0, endSec: 2.5, text: "연구개발에 실패해서" });
});

test("멀티라인 텍스트를 공백으로 합친다", () => {
  const lines = parseSrt(raw);
  expect(lines[1].text).toBe("모든 걸 잃었습니다 그리고 다시 시작했죠");
});

test("총 3개 라인을 파싱한다", () => {
  expect(parseSrt(raw)).toHaveLength(3);
});

test("빈 입력은 빈 배열", () => {
  expect(parseSrt("")).toEqual([]);
  expect(parseSrt("   \n\n  ")).toEqual([]);
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx jest srt`
Expected: FAIL — module not found.

- [ ] **Step 4: 구현**

`lib/parsing/srt.ts`:
```typescript
import type { TranscriptLine } from "@/lib/schemas";

const TIME_RE =
  /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/;

function toSeconds(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

export function parseSrt(raw: string): TranscriptLine[] {
  const blocks = raw.split(/\r?\n\r?\n/);
  const lines: TranscriptLine[] = [];

  for (const block of blocks) {
    const rows = block.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    if (rows.length === 0) continue;

    const timeRowIdx = rows.findIndex((r) => TIME_RE.test(r));
    if (timeRowIdx === -1) continue;

    const m = TIME_RE.exec(rows[timeRowIdx]);
    if (!m) continue;

    const startSec = toSeconds(m[1], m[2], m[3], m[4]);
    const endSec = toSeconds(m[5], m[6], m[7], m[8]);
    const text = rows.slice(timeRowIdx + 1).join(" ");
    lines.push({ startSec, endSec, text });
  }
  return lines;
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx jest srt && npx tsc --noEmit`
Expected: 4 passing, tsc 0 에러.

- [ ] **Step 6: 커밋**

```bash
git add lib/parsing/srt.ts __tests__/srt.test.ts __tests__/fixtures/sample.srt
git commit -m "feat(parsing): add SRT parser to TranscriptLine[]"
```

---

### Task 5: 지표 계산 엔진 (순수, TDD)

**Files:**
- Create: `lib/analysis/metrics.ts`
- Test: `__tests__/metrics.test.ts`

**Interfaces:**
- Consumes: `Reel`, `DerivedRates` from `@/lib/schemas`
- Produces: `computeDerivedRates(reel: Reel): DerivedRates`. 모든 비율 = `metric / views * 100`; `completionRate = avgWatchTimeSec / durationSec * 100`; `followRate`는 `followsFromReel`이 있을 때만. `views === 0`이면 모든 비율 0(0 나눗셈 방어).

- [ ] **Step 1: 실패 테스트 작성**

`__tests__/metrics.test.ts`:
```typescript
import { computeDerivedRates } from "@/lib/analysis/metrics";
import type { Reel } from "@/lib/schemas";

const base: Reel = {
  id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
  views: 10000, reach: 9000, likes: 300, comments: 12,
  saves: 40, shares: 170, avgWatchTimeSec: 20,
};

test("공유율 = shares/views*100", () => {
  expect(computeDerivedRates(base).shareRate).toBeCloseTo(1.7, 5);
});

test("완료율 = avgWatchTime/duration*100", () => {
  expect(computeDerivedRates(base).completionRate).toBeCloseTo(40, 5);
});

test("engagementRate = (likes+comments+saves+shares)/views*100", () => {
  expect(computeDerivedRates(base).engagementRate).toBeCloseTo(5.22, 5);
});

test("followsFromReel 있으면 followRate 계산", () => {
  const r = { ...base, followsFromReel: 50 };
  expect(computeDerivedRates(r).followRate).toBeCloseTo(0.5, 5);
});

test("followsFromReel 없으면 followRate undefined", () => {
  expect(computeDerivedRates(base).followRate).toBeUndefined();
});

test("views가 0이면 모든 비율 0 (0 나눗셈 방어)", () => {
  const r = { ...base, views: 0 };
  const d = computeDerivedRates(r);
  expect(d.shareRate).toBe(0);
  expect(d.engagementRate).toBe(0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest metrics`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

`lib/analysis/metrics.ts`:
```typescript
import type { Reel, DerivedRates } from "@/lib/schemas";

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export function computeDerivedRates(reel: Reel): DerivedRates {
  const { views, likes, comments, saves, shares, avgWatchTimeSec, durationSec } = reel;
  const engagementCount = likes + comments + saves + shares;

  const derived: DerivedRates = {
    shareRate: rate(shares, views),
    saveRate: rate(saves, views),
    likeRate: rate(likes, views),
    commentRate: rate(comments, views),
    engagementRate: rate(engagementCount, views),
    completionRate: rate(avgWatchTimeSec, durationSec),
  };

  if (reel.followsFromReel !== undefined) {
    derived.followRate = rate(reel.followsFromReel, views);
  }
  return derived;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest metrics && npx tsc --noEmit`
Expected: 6 passing.

- [ ] **Step 5: 커밋**

```bash
git add lib/analysis/metrics.ts __tests__/metrics.test.ts
git commit -m "feat(analysis): add derived rate metrics (views denominator)"
```

---

### Task 6: 진단 엔진 — 밴드 판정 + 병목 랭킹 (순수, TDD)

**Files:**
- Create: `lib/analysis/diagnosis.ts`
- Test: `__tests__/diagnosis.test.ts`

**Interfaces:**
- Consumes: `BENCHMARKS`, `MetricKey`, `Threshold` from `@/config/benchmarks`; `Reel`, `DerivedRates` from `@/lib/schemas`; `computeDerivedRates` from `@/lib/analysis/metrics`
- Produces:
  - `type Band = "weak" | "ok" | "strong"`
  - `interface MetricVerdict { key: MetricKey; label: string; value: number; band: Band; priorityScore: number }`
  - `interface Diagnosis { verdicts: MetricVerdict[]; strengths: MetricVerdict[]; weaknesses: MetricVerdict[]; bottleneck: MetricVerdict | null }`
  - `function classifyBand(value: number, t: Threshold): Band`
  - `function diagnose(reel: Reel, thresholds?: Record<MetricKey, Threshold>): Diagnosis` — 값이 없는 지표(예: `hookRetention3s` 미입력, `followRate` 없음)는 verdict에서 제외. 병목 = weaknesses 중 `priorityScore` 최댓값. priorityScore = `weight × max(0, (weakBelow - value) / weakBelow)`.

- [ ] **Step 1: 실패 테스트 작성**

`__tests__/diagnosis.test.ts`:
```typescript
import { classifyBand, diagnose } from "@/lib/analysis/diagnosis";
import { BENCHMARKS } from "@/config/benchmarks";
import type { Reel } from "@/lib/schemas";

test("classifyBand: 경계값", () => {
  expect(classifyBand(44, BENCHMARKS.hookRetention3s)).toBe("weak");
  expect(classifyBand(50, BENCHMARKS.hookRetention3s)).toBe("ok");
  expect(classifyBand(60, BENCHMARKS.hookRetention3s)).toBe("strong");
});

// 훅 35%(약점, weight5), 공유율 1.7%(강점), 나머지 보통/약점 섞임
const reel: Reel = {
  id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
  views: 10000, reach: 9000, likes: 300, comments: 5,
  saves: 20, shares: 170, avgWatchTimeSec: 20,
  hookRetention3s: 35,
};

test("강점에 공유율, 약점에 3초훅이 포함된다", () => {
  const d = diagnose(reel);
  expect(d.strengths.map((v) => v.key)).toContain("shareRate");
  expect(d.weaknesses.map((v) => v.key)).toContain("hookRetention3s");
});

test("병목은 가중치×갭이 최대인 약점 — 여기선 3초훅(weight5)", () => {
  const d = diagnose(reel);
  expect(d.bottleneck?.key).toBe("hookRetention3s");
});

test("hookRetention3s 미입력 시 verdict에서 제외", () => {
  const noHook = { ...reel, hookRetention3s: undefined };
  const d = diagnose(noHook);
  expect(d.verdicts.map((v) => v.key)).not.toContain("hookRetention3s");
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest diagnosis`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

`lib/analysis/diagnosis.ts`:
```typescript
import { BENCHMARKS, type MetricKey, type Threshold } from "@/config/benchmarks";
import type { Reel } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";

export type Band = "weak" | "ok" | "strong";

export interface MetricVerdict {
  key: MetricKey;
  label: string;
  value: number;
  band: Band;
  priorityScore: number;
}

export interface Diagnosis {
  verdicts: MetricVerdict[];
  strengths: MetricVerdict[];
  weaknesses: MetricVerdict[];
  bottleneck: MetricVerdict | null;
}

export function classifyBand(value: number, t: Threshold): Band {
  if (value < t.weakBelow) return "weak";
  if (value > t.strongAbove) return "strong";
  return "ok";
}

// MetricKey → 해당 릴스의 측정값(없으면 undefined)
function metricValues(reel: Reel): Partial<Record<MetricKey, number>> {
  const d = computeDerivedRates(reel);
  return {
    hookRetention3s: reel.hookRetention3s,
    completionRate: d.completionRate,
    shareRate: d.shareRate,
    saveRate: d.saveRate,
    likeRate: d.likeRate,
    commentRate: d.commentRate,
    followRate: d.followRate,
  };
}

function priorityScore(value: number, t: Threshold): number {
  const gap = Math.max(0, (t.weakBelow - value) / t.weakBelow);
  return t.weight * gap;
}

export function diagnose(
  reel: Reel,
  thresholds: Record<MetricKey, Threshold> = BENCHMARKS,
): Diagnosis {
  const values = metricValues(reel);
  const verdicts: MetricVerdict[] = [];

  for (const key of Object.keys(thresholds) as MetricKey[]) {
    const value = values[key];
    if (value === undefined) continue;
    const t = thresholds[key];
    const band = classifyBand(value, t);
    verdicts.push({
      key,
      label: t.label,
      value,
      band,
      priorityScore: band === "weak" ? priorityScore(value, t) : 0,
    });
  }

  const strengths = verdicts.filter((v) => v.band === "strong");
  const weaknesses = verdicts.filter((v) => v.band === "weak");
  const bottleneck =
    weaknesses.length === 0
      ? null
      : weaknesses.reduce((a, b) => (b.priorityScore > a.priorityScore ? b : a));

  return { verdicts, strengths, weaknesses, bottleneck };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest diagnosis && npx tsc --noEmit`
Expected: 4 passing.

- [ ] **Step 5: 커밋**

```bash
git add lib/analysis/diagnosis.ts __tests__/diagnosis.test.ts
git commit -m "feat(analysis): add diagnosis engine with bottleneck ranking"
```

---

### Task 7: 텐션 저하(급락) 구간 탐지 (순수, TDD)

**Files:**
- Create: `lib/analysis/dropDetection.ts`
- Test: `__tests__/dropDetection.test.ts`

**Interfaces:**
- Consumes: `RetentionPoint`, `TranscriptLine` from `@/lib/schemas`; `DROP_THRESHOLD_PCT_PER_SEC`, `HOOK_WINDOW_SEC` from `@/config/benchmarks`
- Produces:
  - `interface DropSegment { startSec: number; endSec: number; dropPct: number; isHook: boolean; lines: TranscriptLine[] }`
  - `function detectDrops(curve: RetentionPoint[], transcript?: TranscriptLine[], thresholdPctPerSec?: number): DropSegment[]` — 인접 포인트 간 `dropPerSec = (pct[i-1]-pct[i]) / (sec[i]-sec[i-1])`가 임계 초과인 구간을 dropPct 내림차순 정렬. `endSec <= HOOK_WINDOW_SEC`면 `isHook = true`. transcript가 있으면 구간 `[startSec,endSec)`와 겹치는 라인을 `lines`에 매핑.

- [ ] **Step 1: 실패 테스트 작성**

`__tests__/dropDetection.test.ts`:
```typescript
import { detectDrops } from "@/lib/analysis/dropDetection";
import type { RetentionPoint, TranscriptLine } from "@/lib/schemas";

const curve: RetentionPoint[] = [
  { sec: 0, pct: 100 },
  { sec: 3, pct: 60 },   // 훅 구간 급락 (13.3%p/s)
  { sec: 6, pct: 55 },   // 완만 (1.7%p/s)
  { sec: 9, pct: 25 },   // 급락 (10%p/s)
  { sec: 12, pct: 22 },
];

test("임계 초과 급락 구간만 탐지한다", () => {
  const drops = detectDrops(curve);
  // 0->3 (40%p), 6->9 (30%p) 두 구간
  expect(drops).toHaveLength(2);
});

test("dropPct 내림차순 정렬", () => {
  const drops = detectDrops(curve);
  expect(drops[0].dropPct).toBeGreaterThanOrEqual(drops[1].dropPct);
});

test("훅 구간(endSec<=3)은 isHook=true", () => {
  const drops = detectDrops(curve);
  const hook = drops.find((d) => d.startSec === 0);
  expect(hook?.isHook).toBe(true);
});

test("SRT 라인을 겹치는 구간에 매핑한다", () => {
  const transcript: TranscriptLine[] = [
    { startSec: 6, endSec: 9, text: "추상적인 설명이 길어집니다" },
  ];
  const drops = detectDrops(curve, transcript);
  const seg = drops.find((d) => d.startSec === 6);
  expect(seg?.lines[0].text).toBe("추상적인 설명이 길어집니다");
});

test("곡선이 2점 미만이면 빈 배열", () => {
  expect(detectDrops([{ sec: 0, pct: 100 }])).toEqual([]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest dropDetection`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

`lib/analysis/dropDetection.ts`:
```typescript
import type { RetentionPoint, TranscriptLine } from "@/lib/schemas";
import { DROP_THRESHOLD_PCT_PER_SEC, HOOK_WINDOW_SEC } from "@/config/benchmarks";

export interface DropSegment {
  startSec: number;
  endSec: number;
  dropPct: number;   // 구간 동안 하락한 잔존 %p
  isHook: boolean;
  lines: TranscriptLine[];
}

function overlappingLines(
  startSec: number,
  endSec: number,
  transcript: TranscriptLine[],
): TranscriptLine[] {
  return transcript.filter((l) => l.startSec < endSec && l.endSec > startSec);
}

export function detectDrops(
  curve: RetentionPoint[],
  transcript: TranscriptLine[] = [],
  thresholdPctPerSec: number = DROP_THRESHOLD_PCT_PER_SEC,
): DropSegment[] {
  if (curve.length < 2) return [];

  const segments: DropSegment[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1];
    const cur = curve[i];
    const span = cur.sec - prev.sec;
    if (span <= 0) continue;

    const dropPct = prev.pct - cur.pct;
    const dropPerSec = dropPct / span;
    if (dropPerSec <= thresholdPctPerSec) continue;

    segments.push({
      startSec: prev.sec,
      endSec: cur.sec,
      dropPct,
      isHook: cur.sec <= HOOK_WINDOW_SEC,
      lines: overlappingLines(prev.sec, cur.sec, transcript),
    });
  }

  return segments.sort((a, b) => b.dropPct - a.dropPct);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest dropDetection && npx tsc --noEmit`
Expected: 5 passing.

- [ ] **Step 5: 커밋**

```bash
git add lib/analysis/dropDetection.ts __tests__/dropDetection.test.ts
git commit -m "feat(analysis): add retention-curve drop detection with SRT mapping"
```

---

### Task 8: 개인화 베이스라인 (롤링 중앙값, 순수, TDD)

**Files:**
- Create: `lib/analysis/baseline.ts`
- Test: `__tests__/baseline.test.ts`

**Interfaces:**
- Consumes: `Reel`, `MetricKey`, `Threshold`, `BENCHMARKS`, `BASELINE_MIN_REELS`; `computeDerivedRates`; `classifyBand` from `@/lib/analysis/diagnosis`
- Produces:
  - `function median(nums: number[]): number`
  - `function buildBaselineThresholds(history: Reel[]): Record<MetricKey, Threshold> | null` — `history.length < BASELINE_MIN_REELS`면 `null`(글로벌 사용). 충분하면 각 지표의 계정 롤링 중앙값(M)을 기준으로 `weakBelow = M*0.85`, `strongAbove = M*1.15` (weight/label은 글로벌 유지).
  - `function deltaVsRecent(reel: Reel, recent: Reel[], key: MetricKey): number | null` — 해당 지표의 현재값 − 최근 N개 평균. 값 없으면 null. (병목 배너의 "지난 3개 평균 대비 +7%p" 용)

- [ ] **Step 1: 실패 테스트 작성**

`__tests__/baseline.test.ts`:
```typescript
import { median, buildBaselineThresholds, deltaVsRecent } from "@/lib/analysis/baseline";
import type { Reel } from "@/lib/schemas";

function reel(id: string, hook: number, shares: number): Reel {
  return {
    id, postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
    views: 10000, reach: 9000, likes: 300, comments: 10,
    saves: 30, shares, avgWatchTimeSec: 20, hookRetention3s: hook,
  };
}

test("median 홀수/짝수", () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([1, 2, 3, 4])).toBe(2.5);
});

test("릴스 5개 미만이면 null (글로벌 임계값 사용)", () => {
  const hist = [reel("1", 50, 170), reel("2", 52, 180)];
  expect(buildBaselineThresholds(hist)).toBeNull();
});

test("릴스 5개 이상이면 중앙값 기반 임계값을 만든다", () => {
  const hist = [40, 45, 50, 55, 60].map((h, i) => reel(String(i), h, 170));
  const t = buildBaselineThresholds(hist);
  expect(t).not.toBeNull();
  // 훅 중앙값 50 → weakBelow 42.5, strongAbove 57.5
  expect(t!.hookRetention3s.weakBelow).toBeCloseTo(42.5, 5);
  expect(t!.hookRetention3s.strongAbove).toBeCloseTo(57.5, 5);
  expect(t!.hookRetention3s.weight).toBe(5); // 글로벌 유지
});

test("deltaVsRecent: 현재 훅 − 최근 평균", () => {
  const current = reel("now", 55, 170);
  const recent = [reel("a", 48, 170), reel("b", 50, 170), reel("c", 52, 170)];
  expect(deltaVsRecent(current, recent, "hookRetention3s")).toBeCloseTo(5, 5); // 55-50
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest baseline`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

`lib/analysis/baseline.ts`:
```typescript
import { BENCHMARKS, BASELINE_MIN_REELS, type MetricKey, type Threshold } from "@/config/benchmarks";
import type { Reel } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function valueOf(reel: Reel, key: MetricKey): number | undefined {
  if (key === "hookRetention3s") return reel.hookRetention3s;
  const d = computeDerivedRates(reel);
  return d[key as keyof typeof d];
}

export function buildBaselineThresholds(
  history: Reel[],
): Record<MetricKey, Threshold> | null {
  if (history.length < BASELINE_MIN_REELS) return null;

  const keys = Object.keys(BENCHMARKS) as MetricKey[];
  const result = {} as Record<MetricKey, Threshold>;

  for (const key of keys) {
    const values = history
      .map((r) => valueOf(r, key))
      .filter((v): v is number => v !== undefined);
    const global = BENCHMARKS[key];

    if (values.length < BASELINE_MIN_REELS) {
      result[key] = global; // 이 지표는 데이터 부족 → 글로벌 유지
      continue;
    }
    const m = median(values);
    result[key] = {
      ...global,
      weakBelow: m * 0.85,
      strongAbove: m * 1.15,
    };
  }
  return result;
}

export function deltaVsRecent(
  reel: Reel,
  recent: Reel[],
  key: MetricKey,
): number | null {
  const current = valueOf(reel, key);
  if (current === undefined) return null;

  const recentValues = recent
    .map((r) => valueOf(r, key))
    .filter((v): v is number => v !== undefined);
  if (recentValues.length === 0) return null;

  const avg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  return current - avg;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest baseline && npx tsc --noEmit`
Expected: 5 passing.

- [ ] **Step 5: 커밋**

```bash
git add lib/analysis/baseline.ts __tests__/baseline.test.ts
git commit -m "feat(analysis): add personalized rolling-median baseline + recent delta"
```

---

### Task 9: 룰 기반 추천 플레이북 (순수, TDD)

**Files:**
- Create: `lib/recommend/playbook.ts`
- Test: `__tests__/playbook.test.ts`

**Interfaces:**
- Consumes: `Diagnosis`, `MetricVerdict` from `@/lib/analysis/diagnosis`; `DropSegment` from `@/lib/analysis/dropDetection`; `MetricKey` from `@/config/benchmarks`
- Produces:
  - `interface Prescription { metric: MetricKey | "dropSegment"; title: string; action: string; severity: "high" | "medium" }`
  - `function buildPlaybook(diagnosis: Diagnosis, drops?: DropSegment[]): Prescription[]` — 스펙 6절 표의 약점→처방 매핑. weakness마다 처방 1개(병목은 severity high, 나머지 medium). drops가 있으면 가장 큰 급락 1건에 대한 컷편집 처방 추가.

- [ ] **Step 1: 실패 테스트 작성**

`__tests__/playbook.test.ts`:
```typescript
import { buildPlaybook } from "@/lib/recommend/playbook";
import { diagnose } from "@/lib/analysis/diagnosis";
import type { Reel } from "@/lib/schemas";

const weakHook: Reel = {
  id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
  views: 10000, reach: 9000, likes: 300, comments: 5,
  saves: 20, shares: 30, avgWatchTimeSec: 20, hookRetention3s: 35,
};

test("훅 약점이면 콜드오픈 처방을 만든다", () => {
  const recs = buildPlaybook(diagnose(weakHook));
  const hookRec = recs.find((r) => r.metric === "hookRetention3s");
  expect(hookRec).toBeDefined();
  expect(hookRec!.action).toMatch(/콜드 오픈|2~3초/);
});

test("병목 처방은 severity high", () => {
  const recs = buildPlaybook(diagnose(weakHook));
  const hookRec = recs.find((r) => r.metric === "hookRetention3s");
  expect(hookRec!.severity).toBe("high");
});

test("급락 구간이 있으면 컷편집 처방 추가", () => {
  const recs = buildPlaybook(diagnose(weakHook), [
    { startSec: 8, endSec: 10, dropPct: 22, isHook: false, lines: [] },
  ]);
  expect(recs.some((r) => r.metric === "dropSegment")).toBe(true);
});

test("약점이 없으면 빈 배열(급락도 없을 때)", () => {
  const strong: Reel = { ...weakHook, hookRetention3s: 70, shares: 200, comments: 50, saves: 100 };
  expect(buildPlaybook(diagnose(strong))).toEqual([]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest playbook`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현 (스펙 6절 매핑 전사)**

`lib/recommend/playbook.ts`:
```typescript
import type { Diagnosis } from "@/lib/analysis/diagnosis";
import type { DropSegment } from "@/lib/analysis/dropDetection";
import type { MetricKey } from "@/config/benchmarks";

export interface Prescription {
  metric: MetricKey | "dropSegment";
  title: string;
  action: string;
  severity: "high" | "medium";
}

// 스펙 6절 계층1 — 약점 플래그 → 자동 처방 (룰 기반, 결정론)
const PLAYBOOK: Partial<Record<MetricKey, { title: string; action: string }>> = {
  hookRetention3s: {
    title: "3초 훅 강화",
    action: "도입 2~3초 컷, 가장 센 문장으로 콜드 오픈 + 궁금증 갭 생성",
  },
  shareRate: {
    title: "공유 유발",
    action: "공유를 부르는 한 줄(공감/저장각) 삽입",
  },
  commentRate: {
    title: "댓글 유도",
    action: "엔딩에 의견이 갈리는 질문 1개 배치",
  },
  followRate: {
    title: "팔로우 전환",
    action: "엔딩 3단(여운→정체성→이득형 CTA) + 다음편 떡밥 루프",
  },
  completionRate: {
    title: "완료율 개선",
    action: "급락 구간 컷 편집/속도 조절로 늘어지는 흐름 제거",
  },
  saveRate: {
    title: "저장 유발",
    action: "저장하고 싶은 정보(요약·체크리스트)를 화면에 명시",
  },
};

export function buildPlaybook(
  diagnosis: Diagnosis,
  drops: DropSegment[] = [],
): Prescription[] {
  const recs: Prescription[] = [];
  const bottleneckKey = diagnosis.bottleneck?.key;

  for (const w of diagnosis.weaknesses) {
    const entry = PLAYBOOK[w.key];
    if (!entry) continue;
    recs.push({
      metric: w.key,
      title: entry.title,
      action: entry.action,
      severity: w.key === bottleneckKey ? "high" : "medium",
    });
  }

  if (drops.length > 0) {
    const biggest = drops[0];
    recs.push({
      metric: "dropSegment",
      title: `${biggest.startSec}~${biggest.endSec}초 급락 처방`,
      action: `${Math.round(biggest.dropPct)}%p 이탈 구간 — 컷 편집/속도 조절 또는 자막 강조로 텐션 회복`,
      severity: "medium",
    });
  }

  return recs;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest playbook && npx tsc --noEmit`
Expected: 4 passing.

- [ ] **Step 5: 커밋**

```bash
git add lib/recommend/playbook.ts __tests__/playbook.test.ts
git commit -m "feat(recommend): add rule-based prescription playbook"
```

---

### Task 10: JSON 파일 리포지토리 (스토어, TDD)

**Files:**
- Create: `lib/store/reelRepository.ts`
- Test: `__tests__/reelRepository.test.ts`

**Interfaces:**
- Consumes: `Reel`, `ReelSchema` from `@/lib/schemas`
- Produces:
  - `interface ReelRepository { list(): Promise<Reel[]>; get(id: string): Promise<Reel | null>; upsert(reel: Reel): Promise<Reel>; }`
  - `function createJsonReelRepository(dataDir: string): ReelRepository` — `${dataDir}/reels.json`에 배열로 저장. 디렉터리/파일 없으면 생성. `upsert`는 같은 id 덮어쓰기, 없으면 추가. 읽을 때 `ReelSchema`로 검증.

- [ ] **Step 1: 실패 테스트 작성**

`__tests__/reelRepository.test.ts`:
```typescript
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import type { Reel } from "@/lib/schemas";

function tmpRepo() {
  const dir = mkdtempSync(join(tmpdir(), "reels-"));
  return createJsonReelRepository(dir);
}

const reel: Reel = {
  id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
  views: 10000, reach: 9000, likes: 300, comments: 12,
  saves: 40, shares: 170, avgWatchTimeSec: 20,
};

test("처음엔 빈 목록", async () => {
  const repo = tmpRepo();
  expect(await repo.list()).toEqual([]);
});

test("upsert 후 get으로 조회된다", async () => {
  const repo = tmpRepo();
  await repo.upsert(reel);
  expect(await repo.get("r1")).toMatchObject({ id: "r1", views: 10000 });
});

test("같은 id upsert는 덮어쓴다 (중복 안 생김)", async () => {
  const repo = tmpRepo();
  await repo.upsert(reel);
  await repo.upsert({ ...reel, views: 20000 });
  const all = await repo.list();
  expect(all).toHaveLength(1);
  expect(all[0].views).toBe(20000);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest reelRepository`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

`lib/store/reelRepository.ts`:
```typescript
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ReelSchema, type Reel } from "@/lib/schemas";

export interface ReelRepository {
  list(): Promise<Reel[]>;
  get(id: string): Promise<Reel | null>;
  upsert(reel: Reel): Promise<Reel>;
}

export function createJsonReelRepository(dataDir: string): ReelRepository {
  const file = join(dataDir, "reels.json");

  async function readAll(): Promise<Reel[]> {
    if (!existsSync(file)) return [];
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return [];
    return z.array(ReelSchema).parse(JSON.parse(raw));
  }

  async function writeAll(reels: Reel[]): Promise<void> {
    if (!existsSync(dataDir)) await mkdir(dataDir, { recursive: true });
    await writeFile(file, JSON.stringify(reels, null, 2), "utf8");
  }

  return {
    list: () => readAll(),
    async get(id) {
      const all = await readAll();
      return all.find((r) => r.id === id) ?? null;
    },
    async upsert(reel) {
      const validated = ReelSchema.parse(reel);
      const all = await readAll();
      const idx = all.findIndex((r) => r.id === validated.id);
      const next = idx === -1 ? [...all, validated] : all.map((r, i) => (i === idx ? validated : r));
      await writeAll(next);
      return validated;
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest reelRepository && npx tsc --noEmit`
Expected: 3 passing.

- [ ] **Step 5: 커밋**

```bash
git add lib/store/reelRepository.ts __tests__/reelRepository.test.ts
git commit -m "feat(store): add JSON file reel repository behind interface"
```

---

### Task 11: 스크린샷 Vision 파서 (Claude API, 목킹 테스트)

**Files:**
- Create: `lib/parsing/screenshot.ts`
- Test: `__tests__/screenshot.test.ts`

**Interfaces:**
- Consumes: `ScreenshotParse`, `ScreenshotParseSchema` from `@/lib/schemas`; `@anthropic-ai/sdk`
- Produces:
  - `interface AnthropicLike { messages: { create(args: unknown): Promise<{ content: Array<{ type: string; text?: string }> }> } }`
  - `async function parseScreenshot(imageBase64: string, mediaType: string, client: AnthropicLike): Promise<ScreenshotParse>` — Claude Vision에 이미지+지시 프롬프트를 보내고, 반환 텍스트(JSON)를 `ScreenshotParseSchema`로 검증해 리턴. 클라이언트를 주입받아 테스트에서 목킹(라이브 호출 0). 모델 `claude-opus-4-8`.
  - `function getAnthropicClient(): AnthropicLike` — `process.env.ANTHROPIC_API_KEY`로 실제 SDK 인스턴스 생성 (서버 전용).

- [ ] **Step 1: 실패 테스트 작성 (목 클라이언트 주입)**

`__tests__/screenshot.test.ts`:
```typescript
import { parseScreenshot } from "@/lib/parsing/screenshot";

const fakeClient = {
  messages: {
    create: async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            hookRetention3s: 35.3,
            retentionCurve: [{ sec: 0, pct: 100 }, { sec: 3, pct: 35.3 }],
            reachSources: { reelsTab: 60, explore: 30, home: 10 },
          }),
        },
      ],
    }),
  },
};

test("Vision 응답 JSON을 ScreenshotParse로 검증·반환한다", async () => {
  const result = await parseScreenshot("ZmFrZQ==", "image/png", fakeClient);
  expect(result.hookRetention3s).toBeCloseTo(35.3, 3);
  expect(result.retentionCurve).toHaveLength(2);
  expect(result.reachSources?.reelsTab).toBe(60);
});

test("스키마에 안 맞는 응답은 throw", async () => {
  const badClient = {
    messages: { create: async () => ({ content: [{ type: "text", text: '{"hookRetention3s": 999}' }] }) },
  };
  await expect(parseScreenshot("x", "image/png", badClient)).rejects.toThrow();
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest screenshot`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

`lib/parsing/screenshot.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { ScreenshotParseSchema, type ScreenshotParse } from "@/lib/schemas";

export interface AnthropicLike {
  messages: {
    create(args: unknown): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

const SYSTEM_PROMPT = `너는 Instagram/EDIT 인사이트 스크린샷에서 수치를 정확히 읽어내는 파서다.
이미지에서 다음만 추출해 JSON으로만 답하라(설명·코드펜스 금지):
- hookRetention3s: 3초 시점 잔존율(%) 숫자
- retentionCurve: 잔존 곡선 좌표 배열 [{sec, pct}], 곡선이 안 보이면 생략
- reachSources: 유입 소스 비율 {reelsTab, explore, home, profile, other}(%) — 보이는 것만
보이지 않는 값은 필드를 생략하라. 추측 금지.`;

function extractText(content: Array<{ type: string; text?: string }>): string {
  const block = content.find((b) => b.type === "text" && b.text);
  if (!block?.text) throw new Error("Vision 응답에 텍스트 블록이 없습니다");
  return block.text.trim();
}

export async function parseScreenshot(
  imageBase64: string,
  mediaType: string,
  client: AnthropicLike,
): Promise<ScreenshotParse> {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "이 스크린샷의 수치를 JSON으로 추출해줘." },
        ],
      },
    ],
  });

  const text = extractText(response.content);
  const json: unknown = JSON.parse(text);
  return ScreenshotParseSchema.parse(json);
}

export function getAnthropicClient(): AnthropicLike {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다 (.env.local)");
  return new Anthropic({ apiKey }) as unknown as AnthropicLike;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest screenshot && npx tsc --noEmit`
Expected: 2 passing.

- [ ] **Step 5: 커밋**

```bash
git add lib/parsing/screenshot.ts __tests__/screenshot.test.ts
git commit -m "feat(parsing): add Claude Vision screenshot parser (injectable client)"
```

---

### Task 12: API 라우트 (reels, parse-screenshot, recommend)

**Files:**
- Create: `app/api/reels/route.ts`, `app/api/parse-screenshot/route.ts`, `app/api/recommend/route.ts`, `lib/store/index.ts`
- Test: `__tests__/api.test.ts`

**Interfaces:**
- Consumes: 리포지토리, 파서, 분석 엔진 전부
- Produces:
  - `lib/store/index.ts`: `function getRepository(): ReelRepository` — `createJsonReelRepository(join(process.cwd(), "data"))` 싱글턴.
  - `GET /api/reels` → `{ reels: Reel[] }`; `POST /api/reels` (body: Reel) → `{ reel: Reel }` (derived 채워서 저장).
  - `POST /api/parse-screenshot` (body: `{ imageBase64, mediaType }`) → `ScreenshotParse`.
  - `POST /api/recommend` (body: `{ reelId }`) → `{ diagnosis, drops, prescriptions, baselineActive }`.
  - 분석 합성 헬퍼 `analyzeReel(reel, history)`는 라우트에서 재사용하므로 `lib/analysis/analyze.ts`로 추출.

**참고:** 라우트 핸들러는 얇게 — 검증 후 lib 호출. App Router 라우트는 jsdom 없이 직접 import해 함수로 테스트한다.

- [ ] **Step 1: 분석 합성 헬퍼 추출 (실패 테스트 먼저)**

`__tests__/api.test.ts` (1차 — analyze):
```typescript
import { analyzeReel } from "@/lib/analysis/analyze";
import type { Reel } from "@/lib/schemas";

const reel: Reel = {
  id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
  views: 10000, reach: 9000, likes: 300, comments: 5, saves: 20, shares: 30,
  avgWatchTimeSec: 20, hookRetention3s: 35,
  retentionCurve: [{ sec: 0, pct: 100 }, { sec: 3, pct: 35 }, { sec: 9, pct: 5 }],
  transcript: [{ startSec: 3, endSec: 9, text: "늘어지는 설명" }],
};

test("analyzeReel은 진단/급락/처방을 합성한다", () => {
  const out = analyzeReel(reel, []);
  expect(out.diagnosis.bottleneck?.key).toBe("hookRetention3s");
  expect(out.drops.length).toBeGreaterThan(0);
  expect(out.prescriptions.some((p) => p.metric === "hookRetention3s")).toBe(true);
  expect(out.baselineActive).toBe(false); // history 부족
});
```

- [ ] **Step 2: 실패 확인 → 구현**

Run: `npx jest api`
Expected: FAIL — module not found.

`lib/analysis/analyze.ts`:
```typescript
import type { Reel } from "@/lib/schemas";
import { diagnose, type Diagnosis } from "@/lib/analysis/diagnosis";
import { detectDrops, type DropSegment } from "@/lib/analysis/dropDetection";
import { buildPlaybook, type Prescription } from "@/lib/recommend/playbook";
import { buildBaselineThresholds, deltaVsRecent } from "@/lib/analysis/baseline";
import { BENCHMARKS, type MetricKey } from "@/config/benchmarks";

export interface AnalyzeResult {
  diagnosis: Diagnosis;
  drops: DropSegment[];
  prescriptions: Prescription[];
  baselineActive: boolean;
  bottleneckDelta: number | null; // 병목 지표의 최근 3개 대비 델타
}

export function analyzeReel(reel: Reel, history: Reel[]): AnalyzeResult {
  const baseline = buildBaselineThresholds(history);
  const thresholds = baseline ?? BENCHMARKS;
  const diagnosis = diagnose(reel, thresholds);
  const drops = detectDrops(reel.retentionCurve ?? [], reel.transcript ?? []);
  const prescriptions = buildPlaybook(diagnosis, drops);

  const recent = history.slice(-3);
  const bottleneckDelta = diagnosis.bottleneck
    ? deltaVsRecent(reel, recent, diagnosis.bottleneck.key as MetricKey)
    : null;

  return { diagnosis, drops, prescriptions, baselineActive: baseline !== null, bottleneckDelta };
}
```

Run: `npx jest api`
Expected: PASS.

- [ ] **Step 3: 스토어 싱글턴 + reels 라우트**

`lib/store/index.ts`:
```typescript
import { join } from "node:path";
import { createJsonReelRepository, type ReelRepository } from "@/lib/store/reelRepository";

let repo: ReelRepository | null = null;
export function getRepository(): ReelRepository {
  if (!repo) repo = createJsonReelRepository(join(process.cwd(), "data"));
  return repo;
}
```

`app/api/reels/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { ReelSchema } from "@/lib/schemas";
import { computeDerivedRates } from "@/lib/analysis/metrics";

export async function GET() {
  const reels = await getRepository().list();
  return NextResponse.json({ reels });
}

export async function POST(req: Request) {
  const body: unknown = await req.json();
  const parsed = ReelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const reel = { ...parsed.data, derived: computeDerivedRates(parsed.data) };
  const saved = await getRepository().upsert(reel);
  return NextResponse.json({ reel: saved });
}
```

- [ ] **Step 4: parse-screenshot + recommend 라우트**

`app/api/parse-screenshot/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseScreenshot, getAnthropicClient } from "@/lib/parsing/screenshot";

const BodySchema = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

export async function POST(req: Request) {
  const body: unknown = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await parseScreenshot(parsed.data.imageBase64, parsed.data.mediaType, getAnthropicClient());
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "파싱 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

`app/api/recommend/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/store";
import { analyzeReel } from "@/lib/analysis/analyze";

const BodySchema = z.object({ reelId: z.string().min(1) });

export async function POST(req: Request) {
  const body: unknown = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const repo = getRepository();
  const reel = await repo.get(parsed.data.reelId);
  if (!reel) return NextResponse.json({ error: "릴스를 찾을 수 없습니다" }, { status: 404 });

  const history = (await repo.list())
    .filter((r) => r.id !== reel.id)
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  return NextResponse.json(analyzeReel(reel, history));
}
```

- [ ] **Step 5: 전체 테스트 + 타입체크 + 커밋**

Run: `npx jest && npx tsc --noEmit`
Expected: 전체 passing, tsc 0 에러.

```bash
git add lib/analysis/analyze.ts lib/store/index.ts app/api __tests__/api.test.ts
git commit -m "feat(api): add reels, parse-screenshot, recommend routes + analyze synthesis"
```

---

### Task 13: 대시보드 UI 컴포넌트 (시각화)

**Files:**
- Create: `components/BottleneckBanner.tsx`, `components/DiagnosisCards.tsx`, `components/MetricBars.tsx`, `components/RetentionChart.tsx`, `components/GrowthTrend.tsx`, `components/SolutionsPanel.tsx`, `components/ReelPicker.tsx`, `lib/ui/format.ts`
- Test: `__tests__/format.test.ts`

**Interfaces:**
- Consumes: `Diagnosis`, `MetricVerdict`, `DropSegment`, `Prescription`, `Reel`, `AnalyzeResult`
- Produces: 7개 프레젠테이션 컴포넌트(props로 데이터 주입, 페치 로직 없음) + `lib/ui/format.ts`의 `bandColor(band)`, `fmtPct(n)`, `fmtDelta(n)` 순수 헬퍼.

**참고:** 컴포넌트 자체는 결정론 코어가 아니므로 단위테스트는 순수 헬퍼(`format.ts`)만. 시각 검증은 Task 14에서 수동.

- [ ] **Step 1: 포맷 헬퍼 실패 테스트**

`__tests__/format.test.ts`:
```typescript
import { bandColor, fmtPct, fmtDelta } from "@/lib/ui/format";

test("밴드별 색 클래스", () => {
  expect(bandColor("weak")).toContain("red");
  expect(bandColor("ok")).toContain("amber");
  expect(bandColor("strong")).toContain("green");
});

test("퍼센트 포맷", () => {
  expect(fmtPct(1.7)).toBe("1.70%");
});

test("델타 부호 표기", () => {
  expect(fmtDelta(7)).toBe("▲7.0%p");
  expect(fmtDelta(-3.2)).toBe("▼3.2%p");
  expect(fmtDelta(0)).toBe("—");
});
```

- [ ] **Step 2: 실패 확인 → 헬퍼 구현**

Run: `npx jest format` → FAIL.

`lib/ui/format.ts`:
```typescript
import type { Band } from "@/lib/analysis/diagnosis";

export function bandColor(band: Band): string {
  if (band === "weak") return "text-red-600 bg-red-50 border-red-200";
  if (band === "strong") return "text-green-600 bg-green-50 border-green-200";
  return "text-amber-600 bg-amber-50 border-amber-200";
}

export function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function fmtDelta(n: number): string {
  if (n === 0) return "—";
  const arrow = n > 0 ? "▲" : "▼";
  return `${arrow}${Math.abs(n).toFixed(1)}%p`;
}
```

Run: `npx jest format` → PASS.

- [ ] **Step 3: 진단 계열 컴포넌트 (Banner, Cards, MetricBars)**

`components/BottleneckBanner.tsx`:
```tsx
import type { MetricVerdict } from "@/lib/analysis/diagnosis";
import { fmtDelta } from "@/lib/ui/format";

interface Props { bottleneck: MetricVerdict | null; delta: number | null; }

export function BottleneckBanner({ bottleneck, delta }: Props) {
  if (!bottleneck) {
    return <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-700">⚡ 뚜렷한 병목이 없습니다 — 잘 하고 있어요.</div>;
  }
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
      <p className="font-bold text-red-700">⚡ 이번 병목: {bottleneck.label} {bottleneck.value.toFixed(1)}% — 도달이 여기서 막힙니다</p>
      {delta !== null && <p className="text-sm text-neutral-600 mt-1">지난 3개 평균 대비 {fmtDelta(delta)}</p>}
    </div>
  );
}
```

`components/DiagnosisCards.tsx`:
```tsx
import type { MetricVerdict } from "@/lib/analysis/diagnosis";
import { fmtPct } from "@/lib/ui/format";

interface Props { strengths: MetricVerdict[]; weaknesses: MetricVerdict[]; }

function List({ title, items, tone }: { title: string; items: MetricVerdict[]; tone: string }) {
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <h3 className="font-semibold mb-2">{title}</h3>
      {items.length === 0 ? <p className="text-sm text-neutral-400">없음</p> : (
        <ul className="space-y-1 text-sm">
          {items.map((v) => <li key={v.key}>{v.label}: {fmtPct(v.value)}</li>)}
        </ul>
      )}
    </div>
  );
}

export function DiagnosisCards({ strengths, weaknesses }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <List title="🟢 잘되는 점" items={strengths} tone="bg-green-50 border-green-200" />
      <List title="🔴 당장 개선" items={weaknesses} tone="bg-red-50 border-red-200" />
    </div>
  );
}
```

`components/MetricBars.tsx`:
```tsx
import type { MetricVerdict } from "@/lib/analysis/diagnosis";
import { bandColor } from "@/lib/ui/format";

export function MetricBars({ verdicts }: { verdicts: MetricVerdict[] }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">📊 지표</h3>
      {verdicts.map((v) => (
        <div key={v.key} className="flex items-center gap-2 text-sm">
          <span className="w-24 shrink-0">{v.label}</span>
          <div className={`px-2 py-0.5 rounded border ${bandColor(v.band)}`}>{v.value.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 차트 + 성장추이 + 해결책 + 릴스선택**

`components/RetentionChart.tsx` (Recharts 클라이언트 컴포넌트):
```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, ReferenceArea, Tooltip, ResponsiveContainer } from "recharts";
import type { RetentionPoint } from "@/lib/schemas";
import type { DropSegment } from "@/lib/analysis/dropDetection";

interface Props { curve: RetentionPoint[]; drops: DropSegment[]; }

export function RetentionChart({ curve, drops }: Props) {
  if (curve.length === 0) return <p className="text-sm text-neutral-400">잔존 곡선 데이터 없음 (스크린샷 업로드 필요)</p>;
  return (
    <div>
      <h3 className="font-semibold mb-2">📉 잔존 곡선 + 텐션 저하</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={curve}>
          <XAxis dataKey="sec" unit="s" />
          <YAxis domain={[0, 100]} unit="%" />
          <Tooltip />
          {drops.map((d, i) => (
            <ReferenceArea key={i} x1={d.startSec} x2={d.endSec} fill="#ef4444" fillOpacity={0.15} />
          ))}
          <Line type="monotone" dataKey="pct" stroke="#2563eb" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <ul className="mt-2 space-y-1 text-sm">
        {drops.map((d, i) => (
          <li key={i} className="text-red-600">
            {d.startSec}~{d.endSec}초: {Math.round(d.dropPct)}%p 이탈
            {d.lines.length > 0 && <span className="text-neutral-600"> — “{d.lines.map((l) => l.text).join(" ")}”</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`components/GrowthTrend.tsx`:
```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Reel } from "@/lib/schemas";

export function GrowthTrend({ reels }: { reels: Reel[] }) {
  if (reels.length < 2) return <p className="text-sm text-neutral-400">📈 성장 추이는 릴스 2개 이상부터 표시됩니다</p>;
  const data = reels.map((r, i) => ({ idx: i + 1, hook: r.hookRetention3s ?? 0 }));
  return (
    <div>
      <h3 className="font-semibold mb-2">📈 성장 추이 (3초 훅)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <XAxis dataKey="idx" />
          <YAxis domain={[0, 100]} unit="%" />
          <Tooltip />
          <Line type="monotone" dataKey="hook" stroke="#16a34a" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

`components/SolutionsPanel.tsx`:
```tsx
import type { Prescription } from "@/lib/recommend/playbook";

export function SolutionsPanel({ prescriptions }: { prescriptions: Prescription[] }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">💡 해결책 (룰 기반)</h3>
      {prescriptions.length === 0 ? <p className="text-sm text-neutral-400">처방할 약점이 없습니다</p> : (
        <ul className="space-y-2">
          {prescriptions.map((p, i) => (
            <li key={i} className={`rounded border p-3 ${p.severity === "high" ? "border-red-300 bg-red-50" : "border-neutral-200"}`}>
              <p className="font-medium">{p.title}{p.severity === "high" && " ⚡"}</p>
              <p className="text-sm text-neutral-700">{p.action}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`components/ReelPicker.tsx`:
```tsx
"use client";
import type { Reel } from "@/lib/schemas";

interface Props { reels: Reel[]; selectedId: string | null; onSelect: (id: string) => void; }

export function ReelPicker({ reels, selectedId, onSelect }: Props) {
  return (
    <select className="border rounded px-2 py-1" value={selectedId ?? ""} onChange={(e) => onSelect(e.target.value)}>
      <option value="" disabled>릴스 선택…</option>
      {reels.map((r) => (
        <option key={r.id} value={r.id}>{r.id} ({r.durationSec}s)</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 5: 타입체크 + 커밋**

Run: `npx jest format && npx tsc --noEmit`
Expected: format 3 passing, tsc 0 에러.

```bash
git add components lib/ui/format.ts __tests__/format.test.ts
git commit -m "feat(ui): add dashboard visualization components + format helpers"
```

---

### Task 14: 대시보드 페이지 + 모바일 LAN 업로드 페이지 (통합)

**Files:**
- Modify: `app/page.tsx`
- Create: `app/upload/page.tsx`
- Test: 수동 통합 (E2E 스크립트)

**Interfaces:**
- Consumes: 모든 API 라우트 + 컴포넌트
- Produces: `/`에서 릴스 선택→진단/차트/해결책 표시. `/upload`에서 폰으로 스샷 업로드→Vision 파싱→릴스 upsert.

- [ ] **Step 1: 대시보드 페이지 (클라이언트 페치)**

`app/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import type { Reel } from "@/lib/schemas";
import type { AnalyzeResult } from "@/lib/analysis/analyze";
import { ReelPicker } from "@/components/ReelPicker";
import { BottleneckBanner } from "@/components/BottleneckBanner";
import { DiagnosisCards } from "@/components/DiagnosisCards";
import { MetricBars } from "@/components/MetricBars";
import { RetentionChart } from "@/components/RetentionChart";
import { GrowthTrend } from "@/components/GrowthTrend";
import { SolutionsPanel } from "@/components/SolutionsPanel";

export default function Page() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);

  useEffect(() => {
    fetch("/api/reels").then((r) => r.json()).then((d) => setReels(d.reels));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch("/api/recommend", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reelId: selectedId }),
    }).then((r) => r.json()).then(setAnalysis);
  }, [selectedId]);

  const selected = reels.find((r) => r.id === selectedId) ?? null;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">릴스 분석 대시보드</h1>
        <div className="flex gap-2 items-center">
          <ReelPicker reels={reels} selectedId={selectedId} onSelect={setSelectedId} />
          <a href="/upload" className="text-sm text-blue-600 underline">📷 업로드</a>
        </div>
      </div>

      {analysis && selected && (
        <>
          <BottleneckBanner bottleneck={analysis.diagnosis.bottleneck} delta={analysis.bottleneckDelta} />
          <div className="grid grid-cols-2 gap-3">
            <DiagnosisCards strengths={analysis.diagnosis.strengths} weaknesses={analysis.diagnosis.weaknesses} />
            <MetricBars verdicts={analysis.diagnosis.verdicts} />
          </div>
          <RetentionChart curve={selected.retentionCurve ?? []} drops={analysis.drops} />
          <GrowthTrend reels={reels} />
          <SolutionsPanel prescriptions={analysis.prescriptions} />
        </>
      )}
      {!selected && <p className="text-neutral-500">릴스를 선택하면 분석이 표시됩니다.</p>}
    </main>
  );
}
```

- [ ] **Step 2: 모바일 LAN 업로드 페이지**

`app/upload/page.tsx`:
```tsx
"use client";
import { useState } from "react";

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export default function UploadPage() {
  const [reelId, setReelId] = useState("");
  const [status, setStatus] = useState<string>("");

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !reelId) { setStatus("릴스 ID와 이미지를 모두 지정하세요"); return; }
    setStatus("Vision 파싱 중…");
    const imageBase64 = await fileToBase64(file);
    const res = await fetch("/api/parse-screenshot", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mediaType: file.type }),
    });
    if (!res.ok) { setStatus("파싱 실패: " + (await res.text())); return; }
    const parsed = await res.json();
    setStatus("파싱 완료: " + JSON.stringify(parsed));
    // 참고: Phase 1에서는 파싱 결과를 화면에 표시. 릴스 병합 저장 UI는 후속.
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-lg font-bold">📷 스크린샷 업로드</h1>
      <input className="border rounded px-2 py-1 w-full" placeholder="릴스 ID (예: interview-12)"
        value={reelId} onChange={(e) => setReelId(e.target.value)} />
      <input type="file" accept="image/*" capture="environment" onChange={onUpload} />
      {status && <p className="text-sm text-neutral-600 break-all">{status}</p>}
    </main>
  );
}
```

- [ ] **Step 3: 수동 통합 검증**

```bash
# .env.local 에 ANTHROPIC_API_KEY 설정 후
npm run dev
```
검증 항목:
1. `http://localhost:3000` 로딩, 빈 상태 메시지 표시.
2. `curl -X POST localhost:3000/api/reels -H 'Content-Type: application/json' -d @__tests__/fixtures/sample-reel.json` 로 샘플 릴스 1건 등록 → 대시보드 새로고침 시 ReelPicker에 표시.
3. 릴스 선택 → 병목 배너/진단 카드/차트/해결책 렌더.
4. 폰에서 `http://<맥 LAN IP>:3000/upload` 접속(맥과 같은 와이파이) → 스샷 업로드 → 파싱 결과 표시.

`__tests__/fixtures/sample-reel.json` 생성:
```json
{
  "id": "interview-12", "postedAt": "2026-06-01T00:00:00Z", "durationSec": 53,
  "views": 10000, "reach": 9000, "likes": 300, "comments": 5, "saves": 20, "shares": 30,
  "avgWatchTimeSec": 20, "hookRetention3s": 35,
  "retentionCurve": [{"sec":0,"pct":100},{"sec":3,"pct":35},{"sec":9,"pct":8}],
  "transcript": [{"startSec":3,"endSec":9,"text":"추상적인 설명이 길어집니다"}]
}
```

- [ ] **Step 4: 최종 테스트 + 커밋**

Run: `npx jest && npx tsc --noEmit`
Expected: 전체 passing, tsc 0 에러.

```bash
git add app/page.tsx app/upload/page.tsx __tests__/fixtures/sample-reel.json
git commit -m "feat(ui): wire dashboard page + mobile LAN upload page"
```

---

## Self-Review (작성자 체크)

**Spec coverage (Phase 1 범위):**
- 데이터 모델(스펙 4절) → Task 2 ✅
- 임계값(5절) → Task 3 ✅
- SRT 파서(8절) → Task 4 ✅
- 지표 계산(4·5절) → Task 5 ✅
- 진단+병목 랭킹(5절) → Task 6 ✅
- 텐션 저하 탐지(5절) → Task 7 ✅
- 개인화 베이스라인(5절) → Task 8 ✅
- 룰 기반 플레이북(6절 계층1) → Task 9 ✅
- JSON 스토어(10절) → Task 10 ✅
- 스샷 Vision 파싱(2·6절) → Task 11 ✅
- API 라우트 + "실시간" 재분석(2·3절) → Task 12 ✅
- 대시보드 UI(7절 컴포넌트 전부) → Task 13 ✅
- LAN 업로드(8절) + 통합 → Task 14 ✅
- **Phase 2(Graph API)·Phase 3(LLM 생성)는 의도적으로 이 계획에서 제외** → 별도 후속 계획. (스펙 13절 비목표/단계 분리와 일치.)

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "TODO/TBD/적절히 처리" 없음. (upload 페이지의 "릴스 병합 저장 UI는 후속"은 Phase 1 비목표를 명시한 주석이며 동작 코드는 완결됨.)

**Type consistency:** `MetricKey`/`Threshold`(config) · `Reel`/`DerivedRates`/`RetentionPoint`/`TranscriptLine`/`ScreenshotParse`(schemas) · `Diagnosis`/`MetricVerdict`/`Band`(diagnosis) · `DropSegment`(dropDetection) · `Prescription`(playbook) · `AnalyzeResult`(analyze) · `ReelRepository`(store) — 태스크 간 시그니처 일관 확인됨. `computeDerivedRates`, `diagnose`, `detectDrops`, `buildPlaybook`, `buildBaselineThresholds`, `deltaVsRecent`, `analyzeReel`, `parseScreenshot` 이름 전 태스크 통일.

**Scope:** Phase 1 단일 계획으로 적정 (결정론 코어 + 최소 UI). Phase 2/3는 분리.
