import {
  buildTranscriptInsightsPrompt,
  parseTranscriptInsights,
  generateTranscriptInsights,
} from "@/lib/recommend/transcriptInsights";
import type { Reel } from "@/lib/schemas";
import type { TextModel } from "@/lib/llm/types";

const reel: Reel = {
  id: "r1",
  postedAt: "2026-06-01T00:00:00Z",
  durationSec: 0,
  views: 2652,
  reach: 2046,
  likes: 50,
  comments: 8,
  saves: 9,
  shares: 17,
  avgWatchTimeSec: 9.47,
  skipRate: 68.56,
  caption: "창업 인터뷰",
  transcript: [
    { startSec: 6.2, endSec: 7.4, text: "약간 반항심이었어요" },
    { startSec: 7.4, endSec: 8.7, text: "지금 공부하는게" },
  ],
};

test("buildTranscriptInsightsPrompt는 자막 전문과 지표를 컨텍스트에 담는다", () => {
  const { system, userText } = buildTranscriptInsightsPrompt(reel);
  expect(system).toMatch(/JSON/);
  expect(userText).toContain("약간 반항심이었어요"); // 자막
  expect(userText).toContain("2652"); // 조회수
  expect(userText).toMatch(/skip|스킵|68.56/i); // 스킵률
});

const valid = JSON.stringify({
  summary: "도입이 느려 초반 이탈이 큽니다.",
  strengths: [{ title: "진솔한 서사", detail: "솔직한 어조가 공유율 0.6%로 이어짐", metric: "shareRate" }],
  weaknesses: [{ title: "느린 훅", detail: "6초까지 본론이 안 나와 skip 68.56%", metric: "skipRate" }],
});

test("parseTranscriptInsights는 코드펜스 JSON을 파싱한다", () => {
  const fenced = "```json\n" + valid + "\n```";
  const r = parseTranscriptInsights(fenced);
  expect(r.weaknesses[0].metric).toBe("skipRate");
  expect(r.strengths).toHaveLength(1);
});

test("parseTranscriptInsights는 스키마 위반 시 throw", () => {
  expect(() => parseTranscriptInsights('{"summary": 123}')).toThrow();
});

test("generateTranscriptInsights는 모델 출력을 합성한다", async () => {
  const fakeModel: TextModel = { generate: async () => valid };
  const r = await generateTranscriptInsights(reel, fakeModel);
  expect(r.summary).toContain("도입");
  expect(r.weaknesses[0].title).toBe("느린 훅");
});

test("buildTranscriptInsightsPrompt는 각 참여 지표에 계정 기준(벤치마크) 판정을 붙인다", () => {
  const { userText } = buildTranscriptInsightsPrompt(reel);
  expect(userText).toMatch(/기준/);
  expect(userText).toMatch(/약점권|강점권|중간/);
});

test("buildTranscriptInsightsPrompt는 과거 잔존곡선 데이터를 컨텍스트에 넣지 않는다", () => {
  const withCurve: Reel = {
    ...reel,
    durationSec: 12,
    retentionCurve: [
      { sec: 0, pct: 100 },
      { sec: 6, pct: 90 },
      { sec: 8, pct: 50 }, // 6→8초 40%p 급락
    ],
  };
  const { userText } = buildTranscriptInsightsPrompt(withCurve);
  expect(userText).not.toMatch(/급락 구간/);
  expect(userText).not.toMatch(/잔존 40/);
});

test("시스템 프롬프트는 약점에 rewrite(새 자막) 작성을 요구하고 주제 요약을 금지한다", () => {
  const { system } = buildTranscriptInsightsPrompt(reel);
  expect(system).toMatch(/rewrite/);
  expect(system).toMatch(/주제|요약/);
});

test("parseTranscriptInsights는 weakness의 rewrite 필드를 보존한다", () => {
  const withRewrite = JSON.stringify({
    summary: "s",
    strengths: [],
    weaknesses: [
      {
        title: "느린 훅",
        detail: '"약간 반항심이었어요"로 시작해 skip 68%',
        metric: "skipRate",
        rewrite: "[0-2s] 6개월 만에 끊은 비결, 딱 하나였어요",
      },
    ],
  });
  const r = parseTranscriptInsights(withRewrite);
  expect(r.weaknesses[0].rewrite).toContain("6개월");
});
