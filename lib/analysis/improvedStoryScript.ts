/**
 * 개선된 전개안을 그대로 촬영장에 가져갈 수 있는 텍스트로 옮긴다.
 *
 * 화면은 비트별 카드로 흩어 보여 주지만, 복사해서 붙여넣는 쪽에서는 위에서
 * 아래로 읽히는 한 덩어리가 필요하다. 타임코드를 남겨 둬야 어느 구간에서
 * 무슨 말을 하는지가 대본만 봐도 잡힌다.
 */

import type { ImprovedStory } from "@/lib/schemas";
import { getStoryFormat, getBeatSpec } from "@/lib/analysis/storyFormats";

export function improvedStoryToScript(improved: ImprovedStory): string {
  const format = getStoryFormat(improved.formatId);
  const heading = format ? `# 개선된 전개 — ${format.label}` : "# 개선된 전개";

  const beats = improved.beats.map((beat) => {
    // 라벨을 못 찾아도 빈칸으로 두지 않는다. id라도 남아야 어느 비트인지 안다.
    const label = getBeatSpec(improved.formatId, beat.beatId)?.label ?? beat.beatId;
    return `## ${label} (${beat.startSec}-${beat.endSec}s)\n${beat.line}\n> ${beat.note}`;
  });

  const changes = improved.changes.map((change) => `- ${change}`).join("\n");

  return [heading, improved.premise, ...beats, `## 원본에서 달라진 것\n${changes}`].join("\n\n");
}
