import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonSavedStoryFormatRepository } from "@/lib/store/savedStoryFormatRepository";
import type { SavedStoryFormat } from "@/lib/schemas";

function tmpRepo() {
  return createJsonSavedStoryFormatRepository(mkdtempSync(join(tmpdir(), "story-formats-")));
}

function saved(id: string, overrides: Partial<SavedStoryFormat> = {}): SavedStoryFormat {
  return {
    id,
    story: {
      formatId: "heros-journey",
      confidence: "high",
      rationale: "문제 → 실패 → 해법 순서가 그대로 나타난다",
      beats: [{ beatId: "intro", present: true, summary: "도입" }],
      secretSauceMet: "본인의 통증을 먼저 꺼낸다",
      secretSauceMissed: "실패 과정이 없다",
    },
    source: {
      reelId: id,
      title: "3년간 안 팔리던 텀블러",
      postedAt: "2026-08-01T00:00:00Z",
      permalink: "https://www.instagram.com/reel/abc/",
      views: 12000,
    },
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    ...overrides,
  };
}

test("처음엔 빈 목록", async () => {
  expect(await tmpRepo().list()).toEqual([]);
});

test("담은 포맷을 id로 다시 꺼낸다", async () => {
  const repo = tmpRepo();
  await repo.upsert(saved("r1"));
  expect(await repo.get("r1")).toMatchObject({ id: "r1" });
});

test("같은 릴스를 다시 저장하면 줄이 늘지 않고 갱신된다", async () => {
  const repo = tmpRepo();
  await repo.upsert(saved("r1"));
  await repo.upsert(saved("r1", { story: { ...saved("r1").story, confidence: "low" } }));

  const all = await repo.list();
  expect(all).toHaveLength(1);
  expect(all[0].story.confidence).toBe("low");
});

test("목록은 담은 순서(createdAt)대로 준다", async () => {
  const repo = tmpRepo();
  await repo.upsert(saved("r2", { createdAt: "2026-08-02T09:00:00.000Z" }));
  await repo.upsert(saved("r1", { createdAt: "2026-08-01T09:00:00.000Z" }));

  expect((await repo.list()).map((item) => item.id)).toEqual(["r1", "r2"]);
});

test("스키마 밖 필드는 디스크까지 가지 않는다", async () => {
  const repo = tmpRepo();
  const stored = await repo.upsert({ ...saved("r1"), 몰래: "값" } as SavedStoryFormat);
  expect(stored).not.toHaveProperty("몰래");
});

test("없는 포맷을 지우면 false, 있으면 true", async () => {
  const repo = tmpRepo();
  expect(await repo.remove("없음")).toBe(false);

  await repo.upsert(saved("r1"));
  expect(await repo.remove("r1")).toBe(true);
  expect(await repo.list()).toEqual([]);
});
