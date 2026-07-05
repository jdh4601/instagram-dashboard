import { PROVIDER_PRESETS, PROVIDER_IDS } from "@/lib/llm/providers";

test("4개 제공자가 정의된다", () => {
  expect(PROVIDER_IDS).toEqual(["anthropic", "openai", "kimi", "gemini"]);
});

test("anthropic은 네이티브(baseURL null), 기본 모델 claude-opus-4-8", () => {
  expect(PROVIDER_PRESETS.anthropic.baseURL).toBeNull();
  expect(PROVIDER_PRESETS.anthropic.defaultModel).toBe("claude-opus-4-8");
});

test("kimi는 moonshot baseURL을 가진다", () => {
  expect(PROVIDER_PRESETS.kimi.baseURL).toContain("moonshot");
});

test("모든 제공자는 vision 지원으로 표시된다", () => {
  for (const id of PROVIDER_IDS) {
    expect(PROVIDER_PRESETS[id].vision).toBe(true);
  }
});

test("모든 제공자는 선택 가능한 모델 목록을 가지며 기본 모델을 포함한다", () => {
  for (const id of PROVIDER_IDS) {
    const preset = PROVIDER_PRESETS[id];
    expect(preset.models.length).toBeGreaterThan(0);
    expect(preset.models).toContain(preset.defaultModel);
  }
});
