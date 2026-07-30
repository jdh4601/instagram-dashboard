import { buildGenerationPrompt, parseGeneration, generateRecommendations } from "@/lib/recommend/generate";
import { diagnose } from "@/lib/analysis/diagnosis";
import type { Reel } from "@/lib/schemas";
import type { TextModel } from "@/lib/llm/types";

const reel: Reel = {
  id: "r1", postedAt: "2026-06-01T00:00:00Z", durationSec: 50,
  views: 10000, reach: 9000, likes: 300, comments: 5, saves: 20, shares: 30,
  avgWatchTimeSec: 20, hookRetention3s: 35,
  caption: "창업 실패에서 배운 것",
  transcript: [
    { startSec: 0, endSec: 3, text: "연구개발에 실패해서" },
    { startSec: 3, endSec: 9, text: "추상적인 설명이 길어집니다" },
  ],
};

const diagnosis = diagnose(reel);

test("buildGenerationPrompt는 대본·병목을 컨텍스트에 담는다", () => {
  const { system, userText } = buildGenerationPrompt(reel, diagnosis);
  expect(system).toMatch(/JSON/);
  expect(userText).toContain("추상적인 설명이 길어집니다"); // SRT
  expect(userText).toContain("3초 훅 잔존"); // 병목 라벨
  expect(userText).toMatch(/자막 구간별 처방/);
});

const validGen = JSON.stringify({
  hooks: ["훅1", "훅2", "훅3"],
  endings: [
    { type: "여운형", text: "엔딩1" },
    { type: "떡밥형", text: "엔딩2" },
    { type: "질문형", text: "엔딩3" },
  ],
  segmentNotes: [{ startSec: 3, endSec: 9, comment: "설명이 추상적", fix: "사례로 바꿔라" }],
  contentComment: "서사는 좋으나 도입이 약함",
});

test("parseGeneration은 코드펜스 JSON을 파싱한다", () => {
  const fenced = "```json\n" + validGen + "\n```";
  const gen = parseGeneration(fenced);
  expect(gen.hooks).toHaveLength(3);
  expect(gen.endings[0].type).toBe("여운형");
  expect(gen.segmentNotes[0].fix).toBe("사례로 바꿔라");
});

test("parseGeneration은 스키마 위반 시 throw", () => {
  expect(() => parseGeneration('{"hooks": "not-array"}')).toThrow();
});

test("generateRecommendations는 모델 출력을 Generation으로 합성한다", async () => {
  const fakeModel: TextModel = { generate: async () => validGen };
  const gen = await generateRecommendations(reel, diagnosis, fakeModel);
  expect(gen.hooks).toHaveLength(3);
  expect(gen.contentComment).toContain("서사");
});
