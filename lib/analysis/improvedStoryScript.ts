/**
 * 개선된 전개안을 그대로 촬영장에 가져갈 수 있는 텍스트로 옮긴다.
 *
 * 화면은 비트별 카드로 흩어 보여 주지만, 복사해서 붙여넣는 쪽에서는 위에서
 * 아래로 읽히는 한 덩어리가 필요하다. 타임코드를 남겨 둬야 어느 구간에서
 * 무슨 말을 하는지가 대본만 봐도 잡힌다.
 */

import type { ImprovedStory } from "@/lib/schemas";
import { getStoryFormat, getBeatSpec } from "@/lib/analysis/storyFormats";
import { getHookTypeSpec } from "@/lib/analysis/hookCatalog";

export function improvedStoryToScript(improved: ImprovedStory): string {
  const format = getStoryFormat(improved.formatId);
  const heading = format ? `# 개선된 전개 — ${format.label}` : "# 개선된 전개";

  const beats = improved.beats.map((beat, index) => {
    // 첫 비트는 화면과 마찬가지로 훅으로 부른다. 유형까지 달아야 복사본만 보고도
    // 3초를 무엇으로 잡는지 안다. 라벨을 못 찾아도 id라도 남긴다.
    const label =
      index === 0
        ? `후킹 — ${getHookTypeSpec(improved.hookType)?.label ?? improved.hookType}`
        : (getBeatSpec(improved.formatId, beat.beatId)?.label ?? beat.beatId);
    return `## ${label} (${beat.startSec}-${beat.endSec}s)\n${beat.line}\n> ${beat.note}`;
  });

  return [heading, improved.premise, ...beats].join("\n\n");
}
