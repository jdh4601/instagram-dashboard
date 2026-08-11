/**
 * 카탈로그 한 항목을 통째로 클립보드에 넣기 위한 마크다운 직렬화.
 *
 * 복사 단위를 문장 낱개가 아니라 유형·원리·포맷 전체로 잡은 이유: 훅 문장만
 * 떼어 가면 그 문장이 왜 먹히는지가 같이 안 따라가서, 붙여넣은 곳에서 다시
 * 원리를 찾아봐야 한다. 설명과 템플릿을 한 덩어리로 옮긴다.
 *
 * 화면 렌더링과 복사 문자열이 같은 함수를 쓰지는 않는다 — 다만 순서와 제목은
 * 맞춰 둬야 복사한 사람이 화면에서 본 것과 같은 걸 받았다고 느낀다.
 */

import type { HookTypeSpec } from "./hookCatalog";
import type { ScriptPrincipleSpec } from "./scriptPrinciples";
import type { StoryBeatSpec, StoryFormatSpec } from "./storyFormats";

/** 마크다운 블록 사이는 빈 줄 하나. 빈 항목은 아예 줄을 만들지 않는다. */
function joinBlocks(blocks: readonly string[]): string {
  return blocks.filter((block) => block.length > 0).join("\n\n");
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * 비트 제목. `optional`인데 라벨에 이미 "(선택)"이 붙은 비트가 있어
 * (`제안 (선택)` 등) 그대로 덧붙이면 표시가 두 번 나온다.
 */
export function beatHeading(beat: StoryBeatSpec): string {
  if (!beat.optional) return beat.label;
  return beat.label.includes("(선택)") ? beat.label : `${beat.label} (선택)`;
}

export function hookTypeToMarkdown(spec: HookTypeSpec): string {
  return joinBlocks([
    `## ${spec.label} (${spec.id})`,
    `**원리** — ${spec.principle}`,
    `**언제 쓰는가** — ${spec.whenToUse}`,
    `### 템플릿 문장\n${bulletList(spec.templates)}`,
    `### 예시\n${bulletList(spec.examples)}`,
  ]);
}

export function scriptPrincipleToMarkdown(spec: ScriptPrincipleSpec): string {
  return joinBlocks([
    `## ${spec.label} (${spec.id})`,
    spec.summary,
    `**정의** — ${spec.definition}`,
    `**왜 작동하는가** — ${spec.whyItWorks}`,
    `### 실행 방법\n${bulletList(spec.howTo)}`,
    `### 나쁜 예 vs 좋은 예\n- 나쁜 예: ${spec.badExample}\n- 좋은 예: ${spec.goodExample}`,
  ]);
}

function beatToMarkdown(beat: StoryBeatSpec, order: number): string {
  const templates = beat.templates.map((template) => `   - ${template}`).join("\n");
  return `${order}. **${beatHeading(beat)}** — ${beat.purpose}\n${templates}`;
}

export function storyFormatToMarkdown(format: StoryFormatSpec): string {
  return joinBlocks([
    `## ${format.label} (${format.id})`,
    format.description,
    `### 아웃라이어 조건\n${bulletList(format.secretSauce)}`,
    `### 비트 시퀀스\n${format.beats
      .map((beat, index) => beatToMarkdown(beat, index + 1))
      .join("\n")}`,
  ]);
}
