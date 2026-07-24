# 캐러셀 지원 + 삭제 게시물 정리 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인스타그램 캐러셀 게시물을 릴스와 함께 수집·표시하는 토글을 추가하고, 삭제·아카이브된 게시물을 동기화 시점에 저장소에서 제거한다.

**Architecture:** `Reel` 스키마에 선택적 `mediaType` 필드를 추가해 릴스와 캐러셀을 구분한다. Graph 수집 계층은 미디어 종류별로 다른 인사이트 지표 세트를 요청하고, 동기화는 API 목록에 없는 저장 레코드를 정리한다. UI는 `app/page.tsx`가 소유한 필터 상태를 목록·참여 지표 위젯에 내려보내고, 릴스 전용 지표 위젯은 항상 릴스만 집계한다.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · Zod 4 · Jest 30 + ts-jest · Tailwind CSS 4 · lucide-react

설계 문서: `docs/superpowers/specs/2026-07-24-carousel-support-and-deleted-post-pruning-design.md`

## Global Constraints

- 언어: 코드 주석과 UI 문구는 한국어. 주석은 **왜**를 적고 무엇을 하는지는 적지 않는다.
- 타입: `strict: true`. `any` 금지 — `unknown` + 타입 가드를 쓴다.
- 불변성: 배열·객체를 변형하지 않고 새로 만든다. 기본은 `const`.
- 저장소 쓰기는 반드시 기존 `withFileLock` + `writeJsonAtomic` 경로를 통과한다. 직접 `writeFile` 금지.
- `Reel` 타입 이름은 바꾸지 않는다. UI 표시 문구만 "게시물"로 바꾼다.
- 액세스 토큰이 포함된 URL 전체를 로깅하는 코드는 절대 추가하지 않는다 (`lib/graph/client.ts` 주석 참조).
- 검증 명령: `npx jest --passWithNoTests` (전체), `npx tsc --noEmit` (타입).
- 커밋 메시지는 Conventional Commits. 각 태스크 끝에서 커밋한다.
- 기존 `__tests__/` 전체가 계속 통과해야 한다.
- 미디어 종류 값은 `"REELS"` / `"CAROUSEL"` 두 개뿐이다. 이 문자열을 정확히 쓴다.

---

# Phase A — 삭제·아카이브 게시물 정리

## Task 1: 저장소에 삭제 메서드 추가

**Files:**
- Modify: `lib/store/reelRepository.ts`
- Modify: `lib/store/reelHistoryRepository.ts`
- Test: `__tests__/storeRemove.test.ts` (신규)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `ReelRepository.removeMany(ids: string[]): Promise<number>` — 실제 삭제된 건수를 반환
  - `ReelHistoryRepository.removeByReelIds(reelIds: string[]): Promise<number>` — 실제 삭제된 스냅샷 건수를 반환

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/storeRemove.test.ts` 생성:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import type { Reel } from "@/lib/schemas";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "store-remove-"));
}

const reel = (id: string): Reel => ({
  id,
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
  avgWatchTimeSec: 10,
});

const snapshot = (reelId: string, date: string) => ({
  reelId,
  date,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
});

test("removeMany는 지정한 릴스만 지우고 삭제 건수를 돌려준다", async () => {
  const repo = createJsonReelRepository(tmpDir());
  await repo.upsert(reel("r1"));
  await repo.upsert(reel("r2"));
  await repo.upsert(reel("r3"));

  const removed = await repo.removeMany(["r1", "r3"]);

  expect(removed).toBe(2);
  expect((await repo.list()).map((r) => r.id)).toEqual(["r2"]);
});

test("removeMany는 없는 id와 빈 배열에서 아무것도 지우지 않는다", async () => {
  const repo = createJsonReelRepository(tmpDir());
  await repo.upsert(reel("r1"));

  expect(await repo.removeMany(["없는-id"])).toBe(0);
  expect(await repo.removeMany([])).toBe(0);
  expect(await repo.list()).toHaveLength(1);
});

test("removeByReelIds는 해당 릴스의 이력만 지운다", async () => {
  const repo = createJsonReelHistoryRepository(tmpDir());
  await repo.add(snapshot("r1", "2026-06-01"));
  await repo.add(snapshot("r1", "2026-06-02"));
  await repo.add(snapshot("r2", "2026-06-01"));

  const removed = await repo.removeByReelIds(["r1"]);

  expect(removed).toBe(2);
  expect(await repo.list("r1")).toHaveLength(0);
  expect(await repo.list("r2")).toHaveLength(1);
});

test("removeByReelIds는 빈 배열에서 아무것도 지우지 않는다", async () => {
  const repo = createJsonReelHistoryRepository(tmpDir());
  await repo.add(snapshot("r1", "2026-06-01"));

  expect(await repo.removeByReelIds([])).toBe(0);
  expect(await repo.list("r1")).toHaveLength(1);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx jest __tests__/storeRemove.test.ts`
Expected: FAIL — `repo.removeMany is not a function` / `repo.removeByReelIds is not a function` (또는 ts-jest 타입 오류)

- [ ] **Step 3: `ReelRepository`에 구현**

`lib/store/reelRepository.ts`의 인터페이스에 한 줄 추가:

```ts
export interface ReelRepository {
  list(): Promise<Reel[]>;
  get(id: string): Promise<Reel | null>;
  upsert(reel: Reel): Promise<Reel>;
  removeMany(ids: string[]): Promise<number>;
}
```

반환 객체의 `upsert` 뒤에 추가:

```ts
    removeMany: (ids) =>
      withFileLock(file, async () => {
        if (ids.length === 0) return 0;
        const doomed = new Set(ids);
        const all = await readAll();
        const next = all.filter((r) => !doomed.has(r.id));
        const removed = all.length - next.length;
        if (removed > 0) await writeJsonAtomic(file, next);
        return removed;
      }),
```

- [ ] **Step 4: `ReelHistoryRepository`에 구현**

`lib/store/reelHistoryRepository.ts`의 인터페이스에 한 줄 추가:

```ts
export interface ReelHistoryRepository {
  list(reelId: string): Promise<ReelMetricSnapshot[]>;
  add(snapshot: ReelMetricSnapshot): Promise<ReelMetricSnapshot>;
  removeByReelIds(reelIds: string[]): Promise<number>;
}
```

반환 객체의 `add` 뒤에 추가:

```ts
    removeByReelIds: (reelIds) =>
      withFileLock(file, async () => {
        if (reelIds.length === 0) return 0;
        const doomed = new Set(reelIds);
        const all = await readAll();
        const next = all.filter((s) => !doomed.has(s.reelId));
        const removed = all.length - next.length;
        if (removed > 0) await writeJsonAtomic(file, next);
        return removed;
      }),
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx jest __tests__/storeRemove.test.ts`
Expected: PASS (4 tests)

Run: `npx tsc --noEmit`
Expected: 출력 없음 (오류 0)

- [ ] **Step 6: 커밋**

```bash
git add lib/store/reelRepository.ts lib/store/reelHistoryRepository.ts __tests__/storeRemove.test.ts
git commit -m "feat(store): 릴스·이력 저장소에 삭제 메서드 추가"
```

---

## Task 2: 동기화 시 삭제·아카이브 게시물 정리

**Files:**
- Modify: `lib/graph/sync.ts`
- Test: `__tests__/syncPrune.test.ts` (신규)

**Interfaces:**
- Consumes: `ReelRepository.removeMany(ids)`, `ReelHistoryRepository.removeByReelIds(reelIds)` (Task 1)
- Produces: `SyncResult.removedReels: number` — 이번 동기화에서 정리된 게시물 수

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/syncPrune.test.ts` 생성:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncFromGraph } from "@/lib/graph/sync";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository } from "@/lib/store/accountRepository";
import { createJsonReelHistoryRepository } from "@/lib/store/reelHistoryRepository";
import type { GraphClient } from "@/lib/graph/client";
import type { GraphMedia } from "@/lib/graph/map";
import type { Reel } from "@/lib/schemas";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "sync-prune-"));
}

const media = (id: string): GraphMedia => ({
  id,
  media_product_type: "REELS",
  timestamp: "2026-06-01T00:00:00+0000",
});

const storedReel = (id: string): Reel => ({
  id,
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
  avgWatchTimeSec: 10,
});

function clientWith(list: GraphMedia[]): GraphClient {
  return {
    getProfile: async () => ({
      userId: "1",
      username: "founder",
      followersCount: 1500,
      mediaCount: list.length,
    }),
    listReels: async () => list,
    getInsights: async () => ({
      metrics: { views: 1000, reach: 800, likes: 10, comments: 1, saved: 2, shares: 3 },
      availableMetrics: ["views", "reach"],
      unavailableMetrics: [],
    }),
    getAccountInsights: async () => ({ metrics: {}, availableMetrics: [], unavailableMetrics: [] }),
  };
}

test("API 목록에 없는 저장 게시물은 삭제되고 removedReels에 집계된다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  await reelRepo.upsert(storedReel("살아있음"));
  await reelRepo.upsert(storedReel("삭제됨"));
  await reelRepo.upsert(storedReel("아카이브됨"));

  const result = await syncFromGraph(
    clientWith([media("살아있음")]),
    reelRepo,
    accountRepo,
    "2026-06-29",
  );

  expect(result.removedReels).toBe(2);
  expect((await reelRepo.list()).map((r) => r.id)).toEqual(["살아있음"]);
});

test("삭제된 게시물의 지표 이력도 함께 지운다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  const historyRepo = createJsonReelHistoryRepository(dir);
  await reelRepo.upsert(storedReel("삭제됨"));
  await historyRepo.add({
    reelId: "삭제됨",
    date: "2026-06-01",
    views: 100,
    reach: 90,
    likes: 5,
    comments: 1,
    saves: 2,
    shares: 3,
  });

  await syncFromGraph(
    clientWith([media("살아있음")]),
    reelRepo,
    accountRepo,
    "2026-06-29",
    undefined,
    historyRepo,
  );

  expect(await historyRepo.list("삭제됨")).toHaveLength(0);
});

test("API 목록이 0건이면 저장된 게시물을 지우지 않는다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  await reelRepo.upsert(storedReel("보존"));

  const result = await syncFromGraph(clientWith([]), reelRepo, accountRepo, "2026-06-29");

  expect(result.removedReels).toBe(0);
  expect(await reelRepo.list()).toHaveLength(1);
});

test("지울 게시물이 없으면 removedReels는 0이다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);
  await reelRepo.upsert(storedReel("살아있음"));

  const result = await syncFromGraph(
    clientWith([media("살아있음")]),
    reelRepo,
    accountRepo,
    "2026-06-29",
  );

  expect(result.removedReels).toBe(0);
  expect(await reelRepo.list()).toHaveLength(1);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx jest __tests__/syncPrune.test.ts`
Expected: FAIL — `expect(result.removedReels).toBe(2)` 에서 `undefined` 수신

- [ ] **Step 3: `SyncResult`에 필드 추가**

`lib/graph/sync.ts`:

```ts
export interface SyncResult {
  syncedReels: number;
  failedReels: number;
  removedReels: number;
  errors: string[];
  followerCount: number;
  username: string;
  availableMetrics: string[];
  unavailableMetrics: string[];
}
```

- [ ] **Step 4: prune 로직 구현**

`lib/graph/sync.ts`에서 "동기화할 릴스가 있었는데 전부 실패하면" 예외 블록 **바로 뒤**, `await accountRepo.add({` **앞**에 삽입:

```ts
  // 인스타그램에서 삭제했거나 보관함으로 옮긴 게시물은 me/media 응답에서 사라진다.
  // API가 둘을 구분해 주지 않으므로 목록에 없는 저장 레코드는 모두 정리한다.
  // 다만 목록이 0건이면 토큰 권한 이상일 수 있고, 그때 전체를 지우면 수동 입력한
  // 자막과 캐시된 LLM 분석까지 복구 불가능하게 사라지므로 건너뛴다.
  let removed = 0;
  if (reels.length > 0) {
    const liveIds = new Set(reels.map((media) => media.id));
    const staleIds = (await reelRepo.list())
      .map((reel) => reel.id)
      .filter((id) => !liveIds.has(id));
    if (staleIds.length > 0) {
      removed = await reelRepo.removeMany(staleIds);
      if (historyRepo) await historyRepo.removeByReelIds(staleIds);
    }
  }
```

그리고 함수 끝의 반환 객체에 한 줄 추가:

```ts
  return {
    syncedReels: synced,
    failedReels: failed,
    removedReels: removed,
    errors,
    followerCount: profile.followersCount,
    username: profile.username,
    availableMetrics: [...availableMetrics].sort(),
    unavailableMetrics: [...unavailableMetrics].sort(),
  };
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx jest __tests__/syncPrune.test.ts`
Expected: PASS (4 tests)

Run: `npx jest`
Expected: 전체 통과. 특히 `graphSync.test.ts`와 `syncFailures.test.ts`가 깨지지 않아야 한다 — 두 파일 모두 저장하는 릴스 id가 클라이언트 목록에 들어 있어 prune 대상이 아니다.

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 6: 커밋**

```bash
git add lib/graph/sync.ts __tests__/syncPrune.test.ts
git commit -m "feat(sync): 삭제·아카이브된 게시물을 동기화 시 정리"
```

---

## Task 3: 정리 결과를 동기화 토스트에 표시

**Files:**
- Modify: `app/page.tsx:81-87` (성공 토스트 생성 부분)

**Interfaces:**
- Consumes: `/api/sync` 응답의 `removedReels: number` (Task 2)
- Produces: 없음 (UI 종단)

이 태스크는 렌더링 변경이라 단위 테스트가 없다. 이 저장소에는 컴포넌트 테스트 도구(@testing-library)가 설치돼 있지 않고 `jest.config.js`의 `testEnvironment`가 `node`다. 검증은 타입 체크와 브라우저 육안 확인으로 한다.

- [ ] **Step 1: 성공 토스트 메시지 수정**

`app/page.tsx`의 `onSync` 안, `const unsupported = ...` 줄부터 `setToast({ tone: "success", ... })` 블록을 다음으로 교체:

```ts
      const unsupported = Array.isArray(data.unavailableMetrics) ? data.unavailableMetrics.length : 0;
      const removed = typeof data.removedReels === "number" ? data.removedReels : 0;
      setToast({
        tone: "success",
        message:
          `동기화 완료: 게시물 ${data.syncedReels}개 · @${data.username}` +
          (removed > 0 ? ` · 삭제된 게시물 ${removed}개 정리` : "") +
          (unsupported > 0 ? ` · 선택 지표 ${unsupported}개 미지원` : ""),
      });
```

- [ ] **Step 2: 부분 실패 토스트 문구도 "게시물"로 통일**

같은 함수의 `failed > 0` 분기에서:

```ts
          message:
            `동기화 일부 실패: 게시물 ${failed}개를 가져오지 못했습니다` +
            (errors.length > 0 ? ` — ${errors.slice(0, 2).join(" / ")}` : ""),
```

- [ ] **Step 3: 타입 체크와 육안 확인**

Run: `npx tsc --noEmit`
Expected: 출력 없음

Run: `npm run dev` → <http://localhost:3000> 에서 **동기화** 버튼 클릭.
Expected: 유령 게시물이 목록에서 사라지고, 토스트에 "삭제된 게시물 N개 정리"가 보인다. (실제 인스타그램 토큰이 설정돼 있어야 한다. 없으면 이 확인은 건너뛰고 Step 4로 간다.)

- [ ] **Step 4: 커밋**

```bash
git add app/page.tsx
git commit -m "feat(dashboard): 동기화 토스트에 정리된 게시물 수 표시"
```

---

# Phase B — 캐러셀 수집과 토글

## Task 4: `mediaType` 스키마 필드와 판별 헬퍼

**Files:**
- Modify: `lib/schemas/index.ts`
- Create: `lib/media/kind.ts`
- Test: `__tests__/mediaKind.test.ts` (신규)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `MediaKindSchema` (zod enum), `type MediaKind = "REELS" | "CAROUSEL"` — `lib/schemas`에서 export
  - `ReelSchema`의 선택 필드 `mediaType?: MediaKind`
  - `mediaKindOf(reel: Reel): MediaKind` — `lib/media/kind.ts`. 필드가 없으면 `"REELS"`를 돌려준다.

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/mediaKind.test.ts` 생성:

```ts
import { ReelSchema, type Reel } from "@/lib/schemas";
import { mediaKindOf } from "@/lib/media/kind";

const base = {
  id: "r1",
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
  avgWatchTimeSec: 10,
};

test("mediaType이 없는 기존 데이터는 그대로 파싱되고 릴스로 읽힌다", () => {
  const parsed = ReelSchema.parse(base);
  expect(parsed.mediaType).toBeUndefined();
  expect(mediaKindOf(parsed)).toBe("REELS");
});

test("mediaType이 CAROUSEL이면 캐러셀로 읽힌다", () => {
  const parsed = ReelSchema.parse({ ...base, mediaType: "CAROUSEL" });
  expect(mediaKindOf(parsed)).toBe("CAROUSEL");
});

test("알 수 없는 mediaType은 파싱을 거부한다", () => {
  expect(() => ReelSchema.parse({ ...base, mediaType: "STORY" })).toThrow();
});

test("mediaKindOf는 명시된 REELS도 그대로 돌려준다", () => {
  const reel: Reel = { ...base, mediaType: "REELS" };
  expect(mediaKindOf(reel)).toBe("REELS");
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx jest __tests__/mediaKind.test.ts`
Expected: FAIL — `Cannot find module '@/lib/media/kind'`

- [ ] **Step 3: 스키마에 필드 추가**

`lib/schemas/index.ts`에서 `ReelSchema` **바로 위**에 추가:

```ts
// 이 대시보드가 다루는 미디어 종류. 인스타그램의 media_product_type/media_type을
// 대시보드가 쓰는 두 값으로 좁힌 것이다.
export const MediaKindSchema = z.enum(["REELS", "CAROUSEL"]);
export type MediaKind = z.infer<typeof MediaKindSchema>;
```

`ReelSchema`의 `id` 다음 줄에 필드 추가:

```ts
export const ReelSchema = z.object({
  id: z.string().min(1),
  // 없으면 릴스. 이 필드가 생기기 전에 저장된 데이터는 전부 릴스뿐이었다.
  mediaType: MediaKindSchema.optional(),
  postedAt: z.string(),
  // ...이하 기존 필드 유지
```

- [ ] **Step 4: 헬퍼 작성**

`lib/media/kind.ts` 생성:

```ts
import type { MediaKind, Reel } from "@/lib/schemas";

// mediaType은 선택 필드다. 이 헬퍼를 거쳐 읽어서 `?? "REELS"`가 코드 곳곳에
// 흩어지지 않게 한다.
export function mediaKindOf(reel: Reel): MediaKind {
  return reel.mediaType ?? "REELS";
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx jest __tests__/mediaKind.test.ts`
Expected: PASS (4 tests)

Run: `npx jest`
Expected: 전체 통과 — 선택 필드라 기존 픽스처는 영향받지 않는다.

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 6: 커밋**

```bash
git add lib/schemas/index.ts lib/media/kind.ts __tests__/mediaKind.test.ts
git commit -m "feat(schema): 게시물 미디어 종류(mediaType) 필드 추가"
```

---

## Task 5: Graph 클라이언트가 캐러셀을 수집하도록 확장

**Files:**
- Modify: `lib/graph/map.ts`
- Modify: `lib/graph/client.ts`
- Modify: `__tests__/graphClient.test.ts` (`listReels` → `listMedia` 개명, 케이스 보강)
- Modify: `__tests__/graphPagination.test.ts` (`listReels` → `listMedia` 개명, 7곳)
- Modify: `__tests__/syncFailures.test.ts:35` (가짜 클라이언트 키 개명)
- Modify: `__tests__/graphSync.test.ts:24` (가짜 클라이언트 키 개명)
- Modify: `__tests__/syncPrune.test.ts` (Task 2에서 만든 가짜 클라이언트 키 개명)
- Test: `__tests__/graphCarousel.test.ts` (신규)

**Interfaces:**
- Consumes: `MediaKind` (Task 4)
- Produces:
  - `classifyMedia(media: GraphMedia): MediaKind | null` — `lib/graph/map.ts`. 대시보드가 다루지 않는 미디어면 `null`
  - `mapMediaToReel(media: GraphMedia, insights: Record<string, number>, kind: MediaKind): Reel` — 세 번째 인자 추가
  - `GraphClient.listMedia(): Promise<GraphMedia[]>` — `listReels`를 대체
  - `GraphClient.getInsights(mediaId: string, kind?: MediaKind): Promise<GraphInsightResult>` — 두 번째 인자는 선택, 생략 시 `"REELS"`

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/graphCarousel.test.ts` 생성:

```ts
import { createGraphClient } from "@/lib/graph/client";
import { classifyMedia, mapMediaToReel } from "@/lib/graph/map";

function fakeFetch(routes: Record<string, unknown>, calls: string[] = []) {
  return async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error("unexpected url: " + url);
    return {
      ok: true,
      json: async () => routes[key],
      text: async () => JSON.stringify(routes[key]),
    };
  };
}

test("classifyMedia는 릴스와 캐러셀만 분류하고 나머지는 null", () => {
  const ts = "2026-06-01T00:00:00+0000";
  expect(classifyMedia({ id: "a", media_product_type: "REELS", timestamp: ts })).toBe("REELS");
  expect(
    classifyMedia({ id: "b", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", timestamp: ts }),
  ).toBe("CAROUSEL");
  expect(classifyMedia({ id: "c", media_type: "IMAGE", media_product_type: "FEED", timestamp: ts })).toBeNull();
});

test("listMedia는 릴스와 캐러셀을 함께 반환하고 단일 사진 글은 제외한다", async () => {
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: fakeFetch({
      "/me/media": {
        data: [
          { id: "reel", media_product_type: "REELS", timestamp: "2026-06-01T00:00:00+0000" },
          { id: "carousel", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", timestamp: "2026-06-02T00:00:00+0000" },
          { id: "photo", media_type: "IMAGE", media_product_type: "FEED", timestamp: "2026-06-03T00:00:00+0000" },
        ],
      },
    }) as unknown as typeof fetch,
  });

  const media = await client.listMedia();
  expect(media.map((m) => m.id)).toEqual(["reel", "carousel"]);
});

test("listMedia는 캐러셀 썸네일용으로 media_url도 요청한다", async () => {
  const calls: string[] = [];
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: fakeFetch({ "/me/media": { data: [] } }, calls) as unknown as typeof fetch,
  });

  await client.listMedia();
  expect(calls[0]).toContain("media_url");
});

test("캐러셀 인사이트는 릴스 전용 지표를 요청하지 않는다", async () => {
  const calls: string[] = [];
  const client = createGraphClient({
    accessToken: "tok",
    fetchImpl: fakeFetch(
      { "/insights": { data: [{ name: "reach", values: [{ value: 500 }] }] } },
      calls,
    ) as unknown as typeof fetch,
  });

  await client.getInsights("carousel-1", "CAROUSEL");

  const requested = calls.join(" ");
  expect(requested).not.toContain("ig_reels_avg_watch_time");
  expect(requested).not.toContain("reels_skip_rate");
  expect(requested).not.toContain("clips_replays_count");
  expect(requested).toContain("reach");
});

test("mapMediaToReel은 캐러셀에 mediaType을 심고 영상 지표를 비운다", () => {
  const reel = mapMediaToReel(
    {
      id: "carousel",
      media_type: "CAROUSEL_ALBUM",
      media_product_type: "FEED",
      timestamp: "2026-06-02T00:00:00+0000",
      media_url: "https://cdn/first-slide.jpg",
    },
    { reach: 500, likes: 30, comments: 2, saved: 8, shares: 4, views: 700 },
    "CAROUSEL",
  );

  expect(reel.mediaType).toBe("CAROUSEL");
  expect(reel.reach).toBe(500);
  expect(reel.views).toBe(700);
  expect(reel.thumbnailUrl).toBe("https://cdn/first-slide.jpg");
  expect(reel.avgWatchTimeSec).toBe(0);
  expect(reel.durationSec).toBe(0);
  expect(reel.skipRate).toBeUndefined();
  expect(reel.hookRetention3s).toBeUndefined();
});

test("mapMediaToReel은 릴스에 mediaType REELS를 심는다", () => {
  const reel = mapMediaToReel(
    { id: "reel", media_product_type: "REELS", timestamp: "2026-06-01T00:00:00+0000", thumbnail_url: "https://cdn/thumb.jpg" },
    { views: 1000, reach: 800, likes: 10, comments: 1, saved: 2, shares: 3, reels_skip_rate: 40 },
    "REELS",
  );

  expect(reel.mediaType).toBe("REELS");
  expect(reel.thumbnailUrl).toBe("https://cdn/thumb.jpg");
  expect(reel.hookRetention3s).toBe(60);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx jest __tests__/graphCarousel.test.ts`
Expected: FAIL — `classifyMedia` export 없음, `client.listMedia is not a function`

- [ ] **Step 3: `lib/graph/map.ts` 수정**

`GraphMedia`에 `media_url` 추가하고, `classifyMedia`를 추가하고, `mapMediaToReel`에 `kind` 인자를 추가한다:

```ts
export interface GraphMedia {
  id: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  caption?: string;
  timestamp: string;
  thumbnail_url?: string;
  permalink?: string;
}

// 대시보드가 다루는 두 종류만 통과시킨다. 단일 사진·단일 영상 피드 글과
// 스토리는 분석 대상이 아니라 null이다.
export function classifyMedia(media: GraphMedia): MediaKind | null {
  if (media.media_product_type === "REELS") return "REELS";
  if (media.media_type === "CAROUSEL_ALBUM") return "CAROUSEL";
  return null;
}
```

파일 상단 import를 다음으로 교체:

```ts
import type { MediaKind, Reel } from "@/lib/schemas";
```

`mapMediaToReel`을 다음으로 교체:

```ts
// API 집계 지표만 매핑. 영상 길이와 초 단위 잔존곡선은 공개 API가 제공하지 않는다.
// 캐러셀에는 영상 지표 자체가 존재하지 않아 insights에 키가 없고, optional()이
// 그대로 undefined를 돌려준다.
export function mapMediaToReel(
  media: GraphMedia,
  insights: Record<string, number>,
  kind: MediaKind,
): Reel {
  const num = (k: string) => insights[k] ?? 0;
  const optional = (k: string) => insights[k];
  const skipRate = optional("reels_skip_rate");
  return {
    id: media.id,
    mediaType: kind,
    postedAt: media.timestamp,
    durationSec: 0, // API 미제공 — 수동 입력으로 보완
    views: num("views"),
    reach: num("reach"),
    likes: num("likes"),
    comments: num("comments"),
    saves: num("saved"),
    shares: num("shares"),
    avgWatchTimeSec: num("ig_reels_avg_watch_time") / 1000, // ms → s
    totalInteractions: optional("total_interactions"),
    totalWatchTimeSec:
      optional("ig_reels_video_view_total_time") === undefined
        ? undefined
        : optional("ig_reels_video_view_total_time")! / 1000,
    replays: optional("clips_replays_count"),
    totalPlays: optional("ig_reels_aggregated_all_plays_count"),
    skipRate,
    skipRateSource: skipRate === undefined ? undefined : "API",
    hookRetention3s: skipRate === undefined ? undefined : 100 - skipRate,
    followsFromReel: optional("follows"),
    profileActivity: optional("profile_activity"),
    profileVisits: optional("profile_visits"),
    caption: media.caption,
    // 캐러셀은 thumbnail_url이 비어 있고 media_url이 첫 장 이미지를 준다.
    thumbnailUrl: media.thumbnail_url ?? media.media_url,
    permalink: media.permalink,
  };
}
```

- [ ] **Step 4: `lib/graph/client.ts` 수정**

상단 import와 상수를 교체:

```ts
import { classifyMedia, flattenInsights, type GraphMedia, type GraphInsightsResponse } from "@/lib/graph/map";
import type { MediaKind } from "@/lib/schemas";
```

`OPTIONAL_REEL_METRICS` 아래에 캐러셀 지표 세트를 추가:

```ts
// 캐러셀에는 ig_reels_*, reels_skip_rate, clips_replays_count가 존재하지 않는다.
// 함께 요청하면 optionalInsights의 폴백이 지표를 하나씩 재요청해 게시물당
// 불필요한 Graph 호출이 여러 번 발생한다.
const REQUIRED_CAROUSEL_METRICS = ["reach", "likes", "comments", "saved", "shares"];

const OPTIONAL_CAROUSEL_METRICS = [
  "views",
  "total_interactions",
  "follows",
  "profile_visits",
  "profile_activity",
];

const METRICS_BY_KIND: Record<MediaKind, { required: string[]; optional: string[] }> = {
  REELS: { required: REQUIRED_REEL_METRICS, optional: OPTIONAL_REEL_METRICS },
  CAROUSEL: { required: REQUIRED_CAROUSEL_METRICS, optional: OPTIONAL_CAROUSEL_METRICS },
};
```

`GraphClient` 인터페이스를 교체:

```ts
export interface GraphClient {
  getProfile(): Promise<GraphProfile>;
  listMedia(): Promise<GraphMedia[]>;
  getInsights(mediaId: string, kind?: MediaKind): Promise<GraphInsightResult>;
  getAccountInsights?(range: { since: string; until: string }): Promise<GraphInsightResult>;
}
```

`createGraphClient` 안의 capability 캐시 선언을 교체 (미디어 종류마다 지원 지표가 다르므로 종류별로 캐시한다):

```ts
  const optionalCapabilities = new Map<MediaKind, { supported: string[]; unavailable: string[] }>();
```

`listReels` 메서드를 `listMedia`로 교체:

```ts
    async listMedia() {
      let page = (await request("me/media", {
        fields: "id,media_type,media_product_type,caption,timestamp,thumbnail_url,media_url,permalink",
        limit: MEDIA_PAGE_SIZE,
      })) as MediaPage;
      const collected: GraphMedia[] = [];
      const seenPages = new Set<string>();
      for (let pageCount = 0; pageCount < MAX_MEDIA_PAGES; pageCount++) {
        for (const media of page.data ?? []) {
          if (classifyMedia(media) !== null) collected.push(media);
        }
        const next = page.paging?.next;
        if (!next) return collected;
        // 일부만 반환하면 진단 표본이 조용히 잘리므로 안전 상한에서는 명시적으로 실패한다.
        if (pageCount + 1 >= MAX_MEDIA_PAGES) {
          throw new Error(`Graph API 미디어 페이지가 안전 상한(${MAX_MEDIA_PAGES})을 초과했습니다`);
        }
        if (seenPages.has(next)) {
          throw new Error("Graph API 미디어 페이지 커서가 반복되었습니다");
        }
        seenPages.add(next);
        page = await fetchMediaPage(next);
      }
      return collected;
    },
```

`getInsights`를 교체:

```ts
    async getInsights(mediaId, kind = "REELS") {
      const { required: requiredMetrics, optional: optionalMetrics } = METRICS_BY_KIND[kind];
      const json = (await request(`${mediaId}/insights`, {
        metric: requiredMetrics.join(","),
      })) as GraphInsightsResponse;
      const required = flattenInsights(json);
      const cached = optionalCapabilities.get(kind);
      const metricsToRequest = cached?.supported ?? optionalMetrics;
      const optional = await optionalInsights(`${mediaId}/insights`, metricsToRequest);
      if (!cached) {
        optionalCapabilities.set(kind, {
          supported: optional.availableMetrics,
          unavailable: optional.unavailableMetrics,
        });
      }
      return {
        metrics: { ...required, ...optional.metrics },
        availableMetrics: [
          ...requiredMetrics.filter((metric) => metric in required),
          ...optional.availableMetrics,
        ],
        unavailableMetrics: [
          ...(optionalCapabilities.get(kind)?.unavailable ?? []),
          ...optional.unavailableMetrics,
        ].filter((metric, index, values) => values.indexOf(metric) === index),
      };
    },
```

- [ ] **Step 5: 기존 테스트의 `listReels` 호출 개명**

다섯 개 테스트 파일에서 `listReels` → `listMedia`로 바꾼다. 일괄 치환:

```bash
sed -i '' 's/listReels/listMedia/g' \
  __tests__/graphClient.test.ts \
  __tests__/graphPagination.test.ts \
  __tests__/syncFailures.test.ts \
  __tests__/graphSync.test.ts \
  __tests__/syncPrune.test.ts
```

치환 후 `__tests__/graphClient.test.ts`의 테스트 이름 `"listMedia는 REELS 타입만 반환"`은 더 이상 사실이 아니다. 그 테스트는 `media_product_type: "FEED"`이면서 `media_type`이 없는 항목을 제외하는 걸 확인하므로 이름만 정확하게 바꾼다:

```ts
test("listMedia는 분석 대상이 아닌 피드 글을 제외한다", async () => {
```

- [ ] **Step 6: `lib/graph/sync.ts`의 호출부만 최소 수정**

Task 6에서 종류별 처리를 붙이기 전에, 개명된 메서드로 컴파일이 되게 한다.

`lib/graph/sync.ts`에서 `client.listReels(),` → `client.listMedia(),` 로 바꾸고, `mapMediaToReel(media, insights.metrics)` → `mapMediaToReel(media, insights.metrics, "REELS")` 로 바꾼다. (Task 6에서 실제 종류를 넘기도록 고친다.)

- [ ] **Step 7: 테스트 통과 확인**

Run: `npx jest __tests__/graphCarousel.test.ts`
Expected: PASS (6 tests)

Run: `npx jest`
Expected: 전체 통과

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 8: 커밋**

```bash
git add lib/graph/client.ts lib/graph/map.ts lib/graph/sync.ts __tests__/
git commit -m "feat(graph): 캐러셀 미디어 수집과 종류별 인사이트 지표 분리"
```

---

## Task 6: 동기화가 캐러셀을 종류에 맞게 저장

**Files:**
- Modify: `lib/graph/sync.ts`
- Test: `__tests__/syncCarousel.test.ts` (신규)

**Interfaces:**
- Consumes: `classifyMedia`, `mapMediaToReel(media, insights, kind)`, `GraphClient.getInsights(id, kind)` (Task 5)
- Produces: 저장된 `Reel.mediaType`이 실제 미디어 종류를 담는다

`mergeWithExisting`은 `{ ...mapped, ... }`로 시작하므로 `mediaType`이 자동으로 새 값을 따라간다. 별도 수정이 필요 없다.

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/syncCarousel.test.ts` 생성:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncFromGraph } from "@/lib/graph/sync";
import { createJsonReelRepository } from "@/lib/store/reelRepository";
import { createJsonAccountRepository } from "@/lib/store/accountRepository";
import type { GraphClient } from "@/lib/graph/client";
import type { MediaKind } from "@/lib/schemas";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "sync-carousel-"));
}

// getInsights가 어떤 종류로 호출됐는지 기록하는 가짜 클라이언트
function recordingClient(seen: Record<string, MediaKind | undefined>): GraphClient {
  return {
    getProfile: async () => ({ userId: "1", username: "founder", followersCount: 100, mediaCount: 2 }),
    listMedia: async () => [
      { id: "reel-1", media_product_type: "REELS", timestamp: "2026-06-01T00:00:00+0000" },
      {
        id: "carousel-1",
        media_type: "CAROUSEL_ALBUM",
        media_product_type: "FEED",
        timestamp: "2026-06-02T00:00:00+0000",
        media_url: "https://cdn/slide.jpg",
      },
    ],
    getInsights: async (mediaId, kind) => {
      seen[mediaId] = kind;
      return {
        metrics: { views: 700, reach: 500, likes: 30, comments: 2, saved: 8, shares: 4 },
        availableMetrics: ["reach"],
        unavailableMetrics: [],
      };
    },
    getAccountInsights: async () => ({ metrics: {}, availableMetrics: [], unavailableMetrics: [] }),
  };
}

test("캐러셀은 CAROUSEL로 저장되고 릴스는 REELS로 저장된다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);
  const accountRepo = createJsonAccountRepository(dir);

  const result = await syncFromGraph(recordingClient({}), reelRepo, accountRepo, "2026-06-29");

  expect(result.syncedReels).toBe(2);
  expect((await reelRepo.get("reel-1"))?.mediaType).toBe("REELS");
  expect((await reelRepo.get("carousel-1"))?.mediaType).toBe("CAROUSEL");
});

test("getInsights에 미디어 종류를 그대로 넘긴다", async () => {
  const dir = tmpDir();
  const seen: Record<string, MediaKind | undefined> = {};

  await syncFromGraph(
    recordingClient(seen),
    createJsonReelRepository(dir),
    createJsonAccountRepository(dir),
    "2026-06-29",
  );

  expect(seen["reel-1"]).toBe("REELS");
  expect(seen["carousel-1"]).toBe("CAROUSEL");
});

test("캐러셀은 첫 장 이미지를 썸네일로 저장한다", async () => {
  const dir = tmpDir();
  const reelRepo = createJsonReelRepository(dir);

  await syncFromGraph(recordingClient({}), reelRepo, createJsonAccountRepository(dir), "2026-06-29");

  expect((await reelRepo.get("carousel-1"))?.thumbnailUrl).toBe("https://cdn/slide.jpg");
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx jest __tests__/syncCarousel.test.ts`
Expected: FAIL — `mediaType`이 `"CAROUSEL"`이 아니라 `"REELS"` (Task 5 Step 6에서 하드코딩해 둔 값)

- [ ] **Step 3: 동기화 루프에 종류 판별 붙이기**

`lib/graph/sync.ts` 상단 import 교체:

```ts
import { classifyMedia, mapMediaToReel } from "@/lib/graph/map";
```

동기화 루프 시작 부분에서 변수 이름을 `reels` → `mediaList`로 바꾸고 종류를 판별한다. `const [profile, reels, accountInsights] = await Promise.all([...])`를 다음으로 교체:

```ts
  const [profile, mediaList, accountInsights] = await Promise.all([
    client.getProfile(),
    client.listMedia(),
    accountInsightsPromise,
  ]);
```

`for (const media of reels) {` 를 다음으로 교체하고, 루프 안 두 줄을 고친다:

```ts
  for (const media of mediaList) {
    try {
      // listMedia가 이미 분석 대상만 통과시키므로 여기서 null이 나올 일은 없다.
      const kind = classifyMedia(media) ?? "REELS";
      const insights = await client.getInsights(media.id, kind);
      insights.availableMetrics.forEach((metric) => availableMetrics.add(metric));
      insights.unavailableMetrics.forEach((metric) => unavailableMetrics.add(metric));
      const mapped = mapMediaToReel(media, insights.metrics, kind);
```

- [ ] **Step 4: 나머지 `reels` 참조를 `mediaList`로 정리**

같은 파일에서 남은 세 곳을 바꾼다.

전체 실패 검사:

```ts
  if (mediaList.length > 0 && synced === 0 && failed > 0) {
    throw new Error(
      `릴스 동기화 전체 실패: ${failed}/${mediaList.length}개 릴스 모두 실패. 원인: ${errors.join(" | ")}`,
    );
  }
```

prune 블록 (Task 2에서 추가한 부분):

```ts
  let removed = 0;
  if (mediaList.length > 0) {
    const liveIds = new Set(mediaList.map((media) => media.id));
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx jest __tests__/syncCarousel.test.ts`
Expected: PASS (3 tests)

Run: `npx jest`
Expected: 전체 통과. `syncFailures.test.ts`의 `/2\/2개 릴스 모두 실패/` 정규식이 그대로 맞아야 한다 (메시지 문구를 바꾸지 않았다).

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 6: 커밋**

```bash
git add lib/graph/sync.ts __tests__/syncCarousel.test.ts
git commit -m "feat(sync): 캐러셀을 미디어 종류에 맞게 수집·저장"
```

---

## Task 7: 미디어 종류 토글과 참여 지표 연동

**Files:**
- Create: `lib/ui/mediaFilter.ts`
- Create: `components/MediaTypeToggle.tsx`
- Modify: `components/ReelList.tsx`
- Modify: `components/AccountOverview.tsx` (fallback 문구 한 줄)
- Modify: `components/DashboardMetrics.tsx` (카드 제목 두 곳)
- Modify: `app/page.tsx`
- Test: `__tests__/mediaFilter.test.ts` (신규)

**Interfaces:**
- Consumes: `mediaKindOf` (Task 4)
- Produces:
  - `type MediaFilter = "REELS" | "CAROUSEL" | "ALL"`
  - `MEDIA_FILTER_LABELS: Record<MediaFilter, string>`
  - `filterByMedia(reels: Reel[], filter: MediaFilter): Reel[]`
  - `<MediaTypeToggle value={filter} onChange={setFilter} />`

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/mediaFilter.test.ts` 생성:

```ts
import { filterByMedia, MEDIA_FILTER_LABELS } from "@/lib/ui/mediaFilter";
import type { Reel } from "@/lib/schemas";

const base = {
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 30,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
  avgWatchTimeSec: 10,
};

const reels: Reel[] = [
  { ...base, id: "레거시" }, // mediaType 없음 = 릴스
  { ...base, id: "릴스", mediaType: "REELS" },
  { ...base, id: "캐러셀", mediaType: "CAROUSEL" },
];

test("REELS 필터는 mediaType이 없는 레거시 데이터도 포함한다", () => {
  expect(filterByMedia(reels, "REELS").map((r) => r.id)).toEqual(["레거시", "릴스"]);
});

test("CAROUSEL 필터는 캐러셀만 돌려준다", () => {
  expect(filterByMedia(reels, "CAROUSEL").map((r) => r.id)).toEqual(["캐러셀"]);
});

test("ALL 필터는 원본 순서 그대로 전부 돌려준다", () => {
  expect(filterByMedia(reels, "ALL").map((r) => r.id)).toEqual(["레거시", "릴스", "캐러셀"]);
});

test("filterByMedia는 원본 배열을 변형하지 않는다", () => {
  const original = [...reels];
  filterByMedia(reels, "CAROUSEL");
  expect(reels).toEqual(original);
});

test("모든 필터에 표시 라벨이 있다", () => {
  expect(MEDIA_FILTER_LABELS.REELS).toBe("릴스");
  expect(MEDIA_FILTER_LABELS.CAROUSEL).toBe("캐러셀");
  expect(MEDIA_FILTER_LABELS.ALL).toBe("전체");
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx jest __tests__/mediaFilter.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ui/mediaFilter'`

- [ ] **Step 3: 필터 순수 함수 작성**

`lib/ui/mediaFilter.ts` 생성:

```ts
import type { Reel } from "@/lib/schemas";
import { mediaKindOf } from "@/lib/media/kind";

export type MediaFilter = "REELS" | "CAROUSEL" | "ALL";

// 토글 버튼 순서의 단일 출처.
export const MEDIA_FILTER_LABELS: Record<MediaFilter, string> = {
  REELS: "릴스",
  CAROUSEL: "캐러셀",
  ALL: "전체",
};

export function filterByMedia(reels: Reel[], filter: MediaFilter): Reel[] {
  if (filter === "ALL") return [...reels];
  return reels.filter((reel) => mediaKindOf(reel) === filter);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest __tests__/mediaFilter.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 토글 컴포넌트 작성**

`components/MediaTypeToggle.tsx` 생성. 마크업은 `ReelList`의 기존 정렬 버튼 그룹과 같은 패턴을 쓴다 (터치 타깃 `min-h-11`, 데스크톱 `sm:min-h-8`):

```tsx
"use client";
import { MEDIA_FILTER_LABELS, type MediaFilter } from "@/lib/ui/mediaFilter";
import { cn } from "@/components/ui";

interface Props {
  value: MediaFilter;
  onChange: (value: MediaFilter) => void;
}

export function MediaTypeToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="미디어 종류 필터"
      className="flex gap-1 rounded-lg border border-border-subtle bg-surface p-0.5"
    >
      {(Object.keys(MEDIA_FILTER_LABELS) as MediaFilter[]).map((filter) => (
        <button
          type="button"
          key={filter}
          onClick={() => onChange(filter)}
          aria-pressed={value === filter}
          className={cn(
            "min-h-11 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-8",
            value === filter ? "bg-brand-600 text-white" : "text-neutral-600 hover:bg-surface-muted",
          )}
        >
          {MEDIA_FILTER_LABELS[filter]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: `ReelList`에 토글 자리 만들기**

`components/ReelList.tsx`:

`Props`를 교체:

```tsx
interface Props {
  reels: Reel[];
  filter: MediaFilter;
  onFilterChange: (value: MediaFilter) => void;
}

export function ReelList({ reels, filter, onFilterChange }: Props) {
```

import 두 줄 추가:

```tsx
import { MediaTypeToggle } from "@/components/MediaTypeToggle";
import type { MediaFilter } from "@/lib/ui/mediaFilter";
```

빈 상태 문구를 교체 (필터 때문에 비었을 수 있다):

```tsx
  if (reels.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">게시물 목록</h2>
          <MediaTypeToggle value={filter} onChange={onFilterChange} />
        </div>
        <div className="rounded-card border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-neutral-500">
          <Film className="mx-auto mb-2 text-neutral-300" size={28} />
          {filter === "CAROUSEL"
            ? "캐러셀 게시물이 없습니다."
            : "아직 게시물이 없습니다. 상단의 동기화로 Instagram에서 가져오세요."}
        </div>
      </section>
    );
  }
```

제목 줄을 교체:

```tsx
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">게시물 목록</h2>
        <div className="flex items-center gap-2">
          <MediaTypeToggle value={filter} onChange={onFilterChange} />
          <span className="text-xs text-neutral-500">{visible.length}개</span>
        </div>
      </div>
```

검색 입력의 `aria-label`과 정렬 그룹의 `aria-label`도 문구를 맞춘다:

```tsx
            aria-label="게시물 제목과 캡션 검색"
```

```tsx
          aria-label="게시물 정렬"
```

- [ ] **Step 7: `app/page.tsx`에 필터 상태 배선**

import 두 줄 추가:

```tsx
import { filterByMedia, type MediaFilter } from "@/lib/ui/mediaFilter";
```

상태 추가 (다른 `useState` 선언들 옆):

```tsx
  // 기본값 릴스 — 토글 도입 전 동작을 유지한다.
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("REELS");
```

집계 계산부를 교체. **릴스 전용 지표(`computeDashboardMetrics`)는 필터와 무관하게 릴스만 쓴다**:

```tsx
  const visibleReels = filterByMedia(reels, mediaFilter);
  const overview = buildAccountOverview(visibleReels, snapshots, profile);
  const followerDelta = latestFollowerDelta(snapshots);
  // 평균 시청시간·3초 잔존율은 캐러셀에 존재하지 않는 지표라 항상 릴스만 집계한다.
  const dashboardMetrics = computeDashboardMetrics(filterByMedia(reels, "REELS"));
  const accountInsights = buildAccountInsights(snapshots);
```

렌더링부에서 두 컴포넌트에 필터된 목록을 넘긴다:

```tsx
              <EngagementPieChart reels={visibleReels} />
```

```tsx
            <ReelList reels={visibleReels} filter={mediaFilter} onFilterChange={setMediaFilter} />
```

- [ ] **Step 8: 릴스 전용 위젯에 기준을 명시**

`components/DashboardMetrics.tsx`의 카드 제목 두 곳을 바꿔, 이 위젯이 토글을 따르지 않는다는 걸 화면에서 알 수 있게 한다:

- `title="시청 시간 / 평균 시청 비율"` → `title="시청 시간 / 평균 시청 비율 (릴스 기준)"`
- `title="3초 잔존율 추이"` → `title="3초 잔존율 추이 (릴스 기준)"`

`components/AccountOverview.tsx`의 fallback 문구도 필터를 따르므로 "릴스"를 뺀다:

```tsx
                ? `게시물 평균 ${fmtPct(overview.avgEngagementRate)}`
```

- [ ] **Step 9: 검증**

Run: `npx jest`
Expected: 전체 통과

Run: `npx tsc --noEmit`
Expected: 출력 없음

Run: `npm run dev` → <http://localhost:3000>
Expected: 게시물 목록 위에 `릴스 | 캐러셀 | 전체` 토글이 보이고, 클릭하면 목록과 인게이지먼트 구성 차트가 함께 바뀐다. "3초 잔존율 추이 (릴스 기준)" 카드는 토글과 무관하게 그대로다.

- [ ] **Step 10: 커밋**

```bash
git add lib/ui/mediaFilter.ts components/MediaTypeToggle.tsx components/ReelList.tsx components/AccountOverview.tsx components/DashboardMetrics.tsx app/page.tsx __tests__/mediaFilter.test.ts
git commit -m "feat(dashboard): 릴스·캐러셀 미디어 종류 토글 추가"
```

---

## Task 8: 캐러셀 상세 페이지 분기와 동종 비교

**Files:**
- Modify: `app/api/reels/[id]/route.ts`
- Modify: `components/ReelPerformanceDashboard.tsx`
- Modify: `app/reel/[id]/page.tsx`
- Test: `__tests__/apiReelDetail.test.ts` (신규)

**Interfaces:**
- Consumes: `mediaKindOf` (Task 4), `filterByMedia` (Task 7)
- Produces: 없음 (기능 종단)

캐러셀에는 `hookRetention3s`와 `completionRate`가 `undefined`라 `diagnose()`가 이미 자동으로 제외한다. 진단 로직 자체는 손대지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

저장소는 mock으로 대체한다 — `__tests__/apiTranscript.test.ts`가 쓰는 것과 같은 패턴이다.

`__tests__/apiReelDetail.test.ts` 생성:

```ts
// reels/[id] 상세 라우트 테스트. 저장소는 mock으로 대체한다.
jest.mock("@/lib/store", () => ({
  getRepository: jest.fn(),
  getReelHistoryRepository: jest.fn(),
}));

import { GET } from "@/app/api/reels/[id]/route";
import { getRepository, getReelHistoryRepository } from "@/lib/store";
import type { Reel } from "@/lib/schemas";

const mockGetRepository = getRepository as unknown as jest.Mock;
const mockGetHistoryRepository = getReelHistoryRepository as unknown as jest.Mock;

const base = {
  durationSec: 0,
  views: 100,
  reach: 90,
  likes: 5,
  comments: 1,
  saves: 2,
  shares: 3,
  avgWatchTimeSec: 0,
};

const reels: Reel[] = [
  { ...base, id: "릴스-1", postedAt: "2026-06-01T00:00:00Z", mediaType: "REELS" },
  { ...base, id: "캐러셀-1", postedAt: "2026-06-02T00:00:00Z", mediaType: "CAROUSEL" },
  { ...base, id: "릴스-2", postedAt: "2026-06-03T00:00:00Z", mediaType: "REELS" },
  { ...base, id: "캐러셀-2", postedAt: "2026-06-04T00:00:00Z", mediaType: "CAROUSEL" },
];

const fakeRepo = {
  list: jest.fn(async () => reels),
  get: jest.fn(async (id: string) => reels.find((r) => r.id === id) ?? null),
};
const fakeHistoryRepo = { list: jest.fn(async () => []) };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRepository.mockReturnValue(fakeRepo);
  mockGetHistoryRepository.mockReturnValue(fakeHistoryRepo);
});

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

async function detail(id: string) {
  const res = await GET(new Request(`http://localhost:3000/api/reels/${id}`), ctx(id));
  return { status: res.status, body: await res.json() };
}

test("이전·다음 이동은 같은 미디어 종류 안에서만 이뤄진다", async () => {
  const { body } = await detail("캐러셀-2");
  expect(body.nav.prevId).toBe("캐러셀-1");
  expect(body.nav.nextId).toBeNull();
});

test("릴스의 이전 게시물은 중간의 캐러셀을 건너뛴다", async () => {
  const { body } = await detail("릴스-2");
  expect(body.nav.prevId).toBe("릴스-1");
});

test("캐러셀 진단에는 훅 잔존·평균 시청 비율 판정이 들어가지 않는다", async () => {
  const { body } = await detail("캐러셀-1");
  const keys = body.analysis.diagnosis.verdicts.map((v: { key: string }) => v.key);
  expect(keys).not.toContain("hookRetention3s");
  expect(keys).not.toContain("completionRate");
  expect(keys).toContain("shareRate");
});

test("없는 id는 404", async () => {
  const { status } = await detail("없는-id");
  expect(status).toBe(404);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx jest __tests__/apiReelDetail.test.ts`
Expected: FAIL — `body.nav.prevId`가 `"릴스-2"` (종류를 가리지 않고 인접 항목을 고름)

- [ ] **Step 3: 상세 라우트에서 동종만 비교**

`app/api/reels/[id]/route.ts` 전체를 교체:

```ts
import { NextResponse } from "next/server";
import { getRepository, getReelHistoryRepository } from "@/lib/store";
import { analyzeReel } from "@/lib/analysis/analyze";
import { reelKpiDeltas } from "@/lib/analysis/reelKpiDeltas";
import { adjacentReelIds } from "@/lib/analysis/reelNavigation";
import { mediaKindOf } from "@/lib/media/kind";

// 게시물 상세: reel + 분석 결과 + 지표 이력
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();
  const reel = await repo.get(id);
  if (!reel) return NextResponse.json({ error: "게시물을 찾을 수 없습니다" }, { status: 404 });

  // 캐러셀 기준선이 릴스 중앙값으로 오염되지 않도록, 그리고 목록에서 보던
  // 종류와 다른 게시물로 이동하지 않도록 같은 미디어 종류끼리만 비교한다.
  const kind = mediaKindOf(reel);
  const sameKind = (await repo.list()).filter((candidate) => mediaKindOf(candidate) === kind);
  const history = sameKind
    .filter((r) => r.id !== reel.id)
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  const analysis = analyzeReel(reel, history);
  const metricHistory = await getReelHistoryRepository().list(id);
  const kpiDeltas = reelKpiDeltas(reel, history);
  const nav = adjacentReelIds(sameKind, reel.id);

  return NextResponse.json({ reel, analysis, metricHistory, kpiDeltas, nav });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest __tests__/apiReelDetail.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 성과 카드에서 영상 지표 숨기기**

`components/ReelPerformanceDashboard.tsx`:

import 추가:

```tsx
import { mediaKindOf } from "@/lib/media/kind";
```

함수 본문 시작에 종류를 읽고, `secondary` 배열의 평균 시청 항목을 조건부로 바꾼다:

```tsx
export function ReelPerformanceDashboard({ reel, deltas }: { reel: Reel; deltas?: ReelKpiDeltas }) {
  const isReel = mediaKindOf(reel) === "REELS";

  const primary: Metric[] = [
    { key: "views", label: "조회수", value: fmtCount(reel.views) },
    { key: "reach", label: "도달", value: fmtCount(reel.reach), note: "고유 계정" },
    { key: "likes", label: "좋아요", value: fmtCount(reel.likes) },
    { key: "comments", label: "댓글", value: fmtCount(reel.comments) },
    { key: "saves", label: "저장", value: fmtCount(reel.saves) },
    { key: "shares", label: "공유", value: fmtCount(reel.shares) },
  ];

  const secondary = [
    // 캐러셀에는 시청 개념이 없다. 나머지 영상 지표는 값 자체가 undefined라 자동으로 빠진다.
    isReel ? { label: "평균 시청", value: `${reel.avgWatchTimeSec.toFixed(1)}초`, source: "API", delta: deltas?.avgWatchTimeSec } : null,
    typeof reel.totalInteractions === "number" ? { label: "총 상호작용", value: fmtCount(reel.totalInteractions), source: "API" } : null,
    typeof reel.totalWatchTimeSec === "number" ? { label: "총 시청 시간", value: fmtDuration(reel.totalWatchTimeSec), source: "API" } : null,
    typeof reel.skipRate === "number" && reel.skipRateSource !== "EDIT" ? { label: "Skip Rate", value: `${reel.skipRate.toFixed(2)}%`, source: "API" } : null,
    typeof reel.replays === "number" ? { label: "재시청", value: fmtCount(reel.replays), source: "API" } : null,
    typeof reel.profileVisits === "number" ? { label: "프로필 방문", value: fmtCount(reel.profileVisits), source: "API" } : null,
    typeof reel.followsFromReel === "number" ? { label: "팔로우", value: fmtCount(reel.followsFromReel), source: "API" } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
```

카드 제목도 종류에 맞춘다:

```tsx
        <h2 className="text-sm font-semibold text-neutral-800">{isReel ? "릴스 성과" : "캐러셀 성과"}</h2>
```

- [ ] **Step 6: 상세 페이지에서 영상 전용 패널 숨기기**

`app/reel/[id]/page.tsx`:

import 추가:

```tsx
import { mediaKindOf } from "@/lib/media/kind";
```

`ReelDetail` 함수 본문 시작에 한 줄 추가:

```tsx
function ReelDetail({ reel, analysis, metricHistory, kpiDeltas, nav, onChange }: DetailResponse & { onChange: () => void }) {
  // 자막과 훅·엔딩 생성은 영상 전제라 캐러셀에서는 의미가 없다.
  const isReel = mediaKindOf(reel) === "REELS";
```

`AiGenerationPanel`과 `SrtUploadCard`를 조건부로 감싼다:

```tsx
      {isReel && <AiGenerationPanel reelId={reel.id} />}
```

```tsx
      {isReel && (
        <SrtUploadCard
          reelId={reel.id}
          analysis={analysis.transcript}
          insights={reel.transcriptInsights}
          onChange={onChange}
        />
      )}
```

이전·다음 링크 문구도 종류에 맞춘다 (`이전 릴스` / `다음 릴스` 두 곳):

```tsx
              <ArrowLeft size={14} /> 이전 {isReel ? "릴스" : "캐러셀"}
```

```tsx
              다음 {isReel ? "릴스" : "캐러셀"} <ArrowRight size={14} />
```

썸네일 비율도 캐러셀에서는 정사각형이 맞다:

```tsx
        <div className={`relative ${isReel ? "aspect-[9/16] w-24" : "aspect-square w-24"} shrink-0 overflow-hidden rounded-card border border-border-subtle bg-neutral-100`}>
```

`InsightList`의 제목도 바꾼다:

```tsx
      <InsightList title={`이 ${isReel ? "릴스" : "캐러셀"}의 핵심 인사이트`} insights={analysis.reelInsights} />
```

`ReelConversionFunnel`은 도달 → 프로필 방문 → 팔로우 구조라 캐러셀에도 그대로 유효하다. 손대지 않는다.

- [ ] **Step 7: 전체 검증**

Run: `npx jest`
Expected: 전체 통과

Run: `npx tsc --noEmit`
Expected: 출력 없음

Run: `npm run dev` → <http://localhost:3000>
Expected:
1. 토글을 **캐러셀**로 바꾸면 캐러셀 게시물이 목록에 나온다.
2. 캐러셀을 클릭하면 상세에서 조회·도달·좋아요·댓글·저장·공유와 진단·처방이 보이고, 평균 시청·Skip Rate·자막 카드·AI 생성 패널은 없다.
3. 상세에서 "다음 캐러셀"을 눌러도 릴스로 튀지 않는다.

- [ ] **Step 8: 커밋**

```bash
git add app/api/reels/\[id\]/route.ts components/ReelPerformanceDashboard.tsx app/reel/\[id\]/page.tsx __tests__/apiReelDetail.test.ts
git commit -m "feat(reel): 캐러셀 상세 분기와 동종 게시물 비교"
```

---

## 완료 확인

모든 태스크가 끝나면:

```bash
npx jest
npx tsc --noEmit
git log --oneline -8
```

Expected: 테스트 전체 통과, 타입 오류 0, 태스크당 커밋 1개씩 8개.

## 이 계획이 다루지 않는 것

설계 문서 11절의 비목표를 그대로 따른다. 단일 사진·단일 영상 피드 게시물, 캐러셀 전용 벤치마크 임계값, `Reel` → `Post` 타입 개명, 삭제된 게시물 다시 보기, 캐러셀 슬라이드별 지표는 이번 범위 밖이다.
